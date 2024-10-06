import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Temporal } from "temporal-polyfill";

import { computeActiveJourneys } from "./jobs/compute-active-journeys.js";
import { initializeResource } from "./jobs/initialize-resource.js";
import { sweepJourneys } from "./jobs/sweep-journeys.js";
import { updateGtfs } from "./jobs/update-gtfs.js";
import type { ActiveJourney } from "./model/active-journey.js";
import { loadConfiguration } from "./source.js";

const configurationName = process.argv[2];
if (typeof configurationName !== "string" || configurationName.includes("\\") || configurationName.includes("/")) {
  console.error("Usage: gtfs-processor <configuration name>");
  process.exit(1);
}

const sources = await loadConfiguration(configurationName);

for (const source of sources) {
  await initializeResource(source);
}

setInterval(
  async () => {
    for (const source of sources) {
      await updateGtfs(source);
    }
  },
  Temporal.Duration.from({ minutes: 5 }).total("milliseconds"),
);

setInterval(
  () => {
    for (const source of sources) {
      sweepJourneys(source);
    }
  },
  Temporal.Duration.from({ hours: 1 }).total("milliseconds"),
);

setInterval(() => {
  global?.gc?.({ flavor: "last-resort", type: "major" });
}, 10_000);

const hono = new Hono();
hono.get("/journeys", async (c) => {
  let activeJourneys: ActiveJourney[] = [];

  for (const source of sources) {
    activeJourneys = activeJourneys.concat(await computeActiveJourneys(source));
  }

  return c.json(activeJourneys);
});

serve({ fetch: hono.fetch, port: 3000 });
