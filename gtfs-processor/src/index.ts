import { serve } from "@hono/node-server";
import DraftLog from "draftlog";
import { Hono } from "hono";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import { computeActiveJourneys } from "./jobs/compute-active-journeys.js";
import { loadGtfs } from "./jobs/load-gtfs.js";
import { sweepJourneys } from "./jobs/sweep-journeys.js";
import { updateGtfs } from "./jobs/update-gtfs.js";
import { loadConfiguration } from "./source.js";
import { createStopWatch } from "./utils/stop-watch.js";

DraftLog(console).addLineListener(process.stdin);

const getTimestamp = () => {
  const now = Temporal.Now.zonedDateTimeISO();
  return `${now.toPlainDate()}T${now.toPlainTime().toString({ smallestUnit: "second" })}`;
};

const configurationName = process.argv[2];
if (typeof configurationName !== "string" || configurationName.includes("\\") || configurationName.includes("/")) {
  console.error("Usage: gtfs-processor <configuration name>");
  process.exit(1);
}

console.log(` ,----.,--------.,------.,---.   ,------.                                                         
'  .-./'--.  .--'|  .---'   .-'  |  .--. ',--.--. ,---.  ,---. ,---.  ,---.  ,---.  ,---. ,--.--. 
|  | .---.|  |   |  \`--,\`.  \`-.  |  '--' ||  .--'| .-. || .--'| .-. :(  .-' (  .-' | .-. ||  .--' 
'  '--'  ||  |   |  |\`  .-'    | |  | --' |  |   ' '-' '  \`--.    --..-'  \`).-'  \`)' '-' '|  |    
 \`------' \`--'   \`--'   \`-----'  \`--'     \`--'    \`---'  \`---' \`----'\`----' \`----'  \`---' \`--'    \n\n`);

const sources = await loadConfiguration(configurationName);

const initLimit = 4;
const initLimitFn = pLimit(initLimit);
const initWatch = createStopWatch();
console.log("%s ► Loading resources (concurrency limit: %d).", getTimestamp(), initLimit);
await Promise.all(sources.map((source) => initLimitFn(() => loadGtfs(source))));
console.log("✓ Load complete in %dms.\n", initWatch.total());

setInterval(
  async () => {
    console.log("%s ► Checking resources staleness.", getTimestamp());
    for (const source of sources) {
      await updateGtfs(source);
    }
    console.log();
  },
  Temporal.Duration.from({ minutes: 5 }).total("milliseconds"),
);

setInterval(
  () => {
    console.log("%s ► Sweeping outdated journey entries.", getTimestamp());
    sources.forEach(sweepJourneys);
    console.log();
  },
  Temporal.Duration.from({ hours: 1 }).total("milliseconds"),
);

const hono = new Hono();
hono.get("/journeys", async (c) => {
  console.log("%s ► Requested active journeys, starting generation.", getTimestamp());
  const watch = createStopWatch();
  const journeys = (await Promise.all(sources.map((source) => computeActiveJourneys(source)))).flat();
  console.log("✓ Generation of %d journeys complete in %dms.\n", journeys.length, watch.total());
  return c.json(journeys);
});

serve({ fetch: hono.fetch, port: 3000 });
