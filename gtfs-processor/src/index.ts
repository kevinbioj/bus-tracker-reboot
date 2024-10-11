import DraftLog from "draftlog";
import pLimit from "p-limit";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { loadConfiguration } from "./configuration.js";
import { computeActiveJourneys } from "./jobs/compute-active-journeys.js";
import { loadGtfs } from "./jobs/load-gtfs.js";
import { sweepJourneys } from "./jobs/sweep-journeys.js";
import { updateGtfs } from "./jobs/update-gtfs.js";
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
await Promise.all(configuration.sources.map((source) => initLimitFn(() => loadGtfs(source))));
console.log("✓ Load complete in %dms.\n", initWatch.total());

console.log("► Initialization is complete.\n");

setInterval(
  async () => {
    console.log("%s ► Checking resources staleness.", getTimestamp());
    for (const source of configuration.sources) {
      await updateGtfs(source);
    }
    console.log();
  },
  Temporal.Duration.from({ minutes: 5 }).total("milliseconds"),
);

setInterval(
  () => {
    console.log("%s ► Sweeping outdated journey entries.", getTimestamp());
    configuration.sources.forEach(sweepJourneys);
    console.log();
  },
  Temporal.Duration.from({ hours: 1 }).total("milliseconds"),
);

async function computeAndPublish() {
  const watch = createStopWatch();
  const computeLimit = 6;
  const computeLimitFn = pLimit(computeLimit);
  const updateLog = console.draft("%s ► Computing active journeys to publish.", getTimestamp());
  try {
    const journeys = (
      await Promise.all(configuration.sources.map((source) => computeLimitFn(() => computeActiveJourneys(source))))
    ).flat();
    updateLog("%s ► Publishing %d journey entries.", getTimestamp(), journeys.length);
    await Promise.all(journeys.map((journey) => redis.publish(channel, JSON.stringify(journey))));
    updateLog("%s ✓ Published %d journey entries in %dms.", getTimestamp(), journeys.length, watch.total());
  } catch (e) {
    updateLog("%s ✘ Something wrong occurred while publishing journeys.", getTimestamp());
    console.error(e);
  }
  console.log();
  setTimeout(computeAndPublish, configuration.computeCron.total("milliseconds"));
}

computeAndPublish();
