import { Cron } from "croner";
import DraftLog from "draftlog";
import pLimit from "p-limit";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { loadConfiguration } from "./configuration.js";
import { computeVehicleJourneys } from "./jobs/compute-vehicle-journeys.js";
import { loadGtfs } from "./jobs/load-gtfs.js";
import { sweepJourneys } from "./jobs/sweep-vehicle-journeys.js";
import { updateGtfs } from "./jobs/update-gtfs.js";
import type { Journey } from "./model/journey.js";
import { padSourceId } from "./utils/pad-source-id.js";
import { createStopWatch } from "./utils/stop-watch.js";

DraftLog(console, !process.stdout.isTTY)?.addLineListener(process.stdin);

const getTimestamp = () => {
  const now = Temporal.Now.zonedDateTimeISO();
  return `${now.toPlainDate()}T${now.toPlainTime().toString({ smallestUnit: "second" })}`;
};

const configurationName = process.argv[2] ?? process.env.CONFIGURATION_NAME;
if (typeof configurationName !== "string" || configurationName.includes("\\") || configurationName.includes("/")) {
  console.error("Usage: gtfs-processor [configuration name]");
  console.error('Note: if no argument is given, environment variable "CONFIGURATION_NAME" will be used.');
  process.exit(1);
}

console.log(` ,----.,--------.,------.,---.   ,------.                                                         
'  .-./'--.  .--'|  .---'   .-'  |  .--. ',--.--. ,---.  ,---. ,---.  ,---.  ,---.  ,---. ,--.--. 
|  | .---.|  |   |  \`--,\`.  \`-.  |  '--' ||  .--'| .-. || .--'| .-. :(  .-' (  .-' | .-. ||  .--' 
'  '--'  ||  |   |  |\`  .-'    | |  | --' |  |   ' '-' '  \`--.    --..-'  \`).-'  \`)' '-' '|  |    
 \`------' \`--'   \`--'   \`-----'  \`--'     \`--'    \`---'  \`---' \`----'\`----' \`----'  \`---' \`--'    \n\n`);

const configuration = await loadConfiguration(configurationName);

console.log("%s ► Connecting to Redis.", getTimestamp());
const redis = createClient(configuration.redisOptions);
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();

const initLimit = 4;
const initLimitFn = pLimit(initLimit);
const initWatch = createStopWatch();
console.log("%s ► Loading resources (concurrency limit: %d).", getTimestamp(), initLimit);
const results = await Promise.allSettled(configuration.sources.map((source) => initLimitFn(() => loadGtfs(source))));
results
  .filter((result) => result.status === "rejected")
  .forEach((result) => {
    console.log();
    console.error(result.reason);
    console.log();
  });
console.log("✓ Load complete in %dms.\n", initWatch.total());

// C'est moche mais je n'ai pas le temps de l'attendre moi-même...
global.gc?.({ execution: "sync", flavor: "last-resort", type: "major" });
console.log("► Initialization is complete.\n");

setInterval(
  async () => {
    console.log("%s ► Checking resources staleness.", getTimestamp());
    for (const source of configuration.sources) {
      try {
        await updateGtfs(source);
      } catch (e) {
        console.log();
        console.error(e);
        console.log();
      }
    }
    console.log();
    global.gc?.();
  },
  Temporal.Duration.from({ minutes: 5 }).total("milliseconds"),
);

setInterval(
  () => {
    console.log("%s ► Sweeping outdated journey entries.", getTimestamp());
    configuration.sources.forEach(sweepJourneys);
    console.log();
    global.gc?.();
  },
  Temporal.Duration.from({ hours: 1 }).total("milliseconds"),
);

new Cron("0 0 0 * * *", () => {
  console.log("%s ► Computing journeys for the next day.", getTimestamp());
  for (const source of configuration.sources) {
    const sourceId = padSourceId(source);
    if (typeof source.gtfs === "undefined") {
      return console.warn("%s ⚠ Source has no loaded GTFS data, ignoring.", sourceId);
    }

    const date = Temporal.Now.plainDateISO();

    const updateLog = console.draft("%s ► Computing journeys for date '%s'.", sourceId, date);
    const watch = createStopWatch();

    let computedJourneys = 0;
    for (const trip of source.gtfs.trips.values()) {
      const journey = trip.getScheduledJourney(date);
      if (typeof journey !== "undefined") {
        source.gtfs.journeys.push(journey);
        computedJourneys += 1;
      }
    }
    source.gtfs.journeys.sort((a, b) =>
      Temporal.ZonedDateTime.compare(a.calls.at(0)!.aimedArrivalTime, b.calls.at(0)!.aimedArrivalTime),
    );

    updateLog("%s ✓ Computed %d journeys for date '%s' in %dms.", sourceId, computedJourneys, date, watch.total());
  }
  console.log();
});

let isComputing = false;
async function computeAndPublish() {
  if (isComputing) return;
  isComputing = true;
  const watch = createStopWatch();
  const computeLimit = 6;
  const computeLimitFn = pLimit(computeLimit);
  const updateLog = console.draft("%s ► Computing vehicle journeys to publish.", getTimestamp());
  try {
    const computationResults = await Promise.allSettled(
      configuration.sources.map((source) => computeLimitFn(() => computeVehicleJourneys(source))),
    );
    const vehicleJourneys = computationResults
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value);
    const failures = computationResults.filter((result) => result.status === "rejected").map((result) => result.reason);
    updateLog("%s ► Publishing %d vehicle journey entries.", getTimestamp(), vehicleJourneys.length);
    await Promise.all(vehicleJourneys.map((vehicleJourney) => redis.publish(channel, JSON.stringify(vehicleJourney))));
    updateLog(
      "%s ✓ Published %d vehicle journey entries in %dms.",
      getTimestamp(),
      vehicleJourneys.length,
      watch.total(),
    );
    failures.forEach((failure) => {
      console.log();
      console.error(failure);
      console.log();
    });
  } catch (e) {
    updateLog("%s ✘ Something wrong occurred while publishing vehicle journeys.", getTimestamp());
    console.error(e);
  }
  console.log();
  global.gc?.();
  isComputing = false;
}

computeAndPublish();
setInterval(computeAndPublish, configuration.computeInterval.total("milliseconds"));
