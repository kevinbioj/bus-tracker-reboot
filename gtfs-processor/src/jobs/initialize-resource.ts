import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import { downloadGtfs } from "../download/download-gtfs.js";
import { importGtfs } from "../import/import-gtfs.js";
import type { Source } from "../source.js";
import { getStaleness } from "../utils/get-staleness.js";
import { createStopWatch } from "../utils/stop-watch.js";

export async function initializeResource(source: Source, bootstrapping = true) {
  const watch = createStopWatch();
  console.log("► %s resource '%s'.", bootstrapping ? "Initializing" : "Updating", source.id);

  const resourceDirectory = await mkdtemp(join(tmpdir(), `bt-gtfs_${source.id}_`));
  console.log("\tⓘ Resource will be extracted into '%s'.", resourceDirectory);

  console.log("\t↳ Downloading resource at '%s'.", source.staticResourceHref);
  await downloadGtfs(source.staticResourceHref, resourceDirectory);
  console.log("\t✓ Download completed in %dms!", watch.step());

  console.log("\t↳ Loading resource into memory.");
  source.gtfs = {
    ...(await importGtfs(resourceDirectory)),
    ...(await getStaleness(source.staticResourceHref).catch(() => ({ lastModified: null, etag: null }))),
    importedAt: Temporal.Now.instant(),
  };
  console.log("\t✓ Load completed in %dms!", watch.step());

  console.log("\t↳ Pre-computing journeys.");
  const now = Temporal.Now.instant();
  const dates = [Temporal.Now.plainDateISO()];
  if (bootstrapping && Temporal.Now.zonedDateTimeISO().hour < 6) {
    dates.push(Temporal.Now.plainDateISO().subtract({ days: 1 }));
  }
  for (const trip of source.gtfs.trips.values()) {
    if (typeof source.allowScheduled === "function" && !source.allowScheduled(trip)) continue;

    const [today, yesterday] = dates;
    if (typeof yesterday !== "undefined") {
      const yesterdayJourney = trip.getScheduledJourney(yesterday);
      if (
        typeof yesterdayJourney !== "undefined" &&
        Temporal.Instant.compare(now, yesterdayJourney.calls.at(-1)!.aimedDepartureTime.toInstant()) < 0
      ) {
        source.gtfs.journeys.push(yesterdayJourney);
      }
    }

    const todayJourney = trip.getScheduledJourney(today!);
    if (
      typeof todayJourney !== "undefined" &&
      Temporal.Instant.compare(now, todayJourney.calls.at(-1)!.aimedDepartureTime.toInstant()) < 0
    ) {
      source.gtfs.journeys.push(todayJourney);
    }

    source.gtfs.journeys.sort(
      (a, b) => a.calls[0]!.aimedArrivalTime.epochSeconds - b.calls[0]!.aimedArrivalTime.epochSeconds,
    );
  }
  console.log("\t✓ Pre-computed %d journeys in %dms!", source.gtfs.journeys.length, watch.step());

  console.log("✓ %s was completed in %dms!\n", bootstrapping ? "Initialization" : "Update", watch.total());
}
