import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import type { Source } from "../configuration.js";
import { downloadGtfs } from "../download/download-gtfs.js";
import { importGtfs } from "../import/import-gtfs.js";
import type { Gtfs } from "../model/gtfs.js";
import { getStaleness } from "../utils/get-staleness.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";

export async function loadGtfs(source: Source, bootstrapping = true) {
  const watch = createStopWatch();
  const sourceId = padSourceId(source);
  const updateLog = console.draft("%s ► Loading GTFS resource...", sourceId);

  try {
    const resourceDirectory = await mkdtemp(join(tmpdir(), `bt-gtfs_${source.id}_`));
    updateLog(
      "%s ► Downloading GTFS resource from '%s' into '%s'.",
      sourceId,
      source.staticResourceHref,
      resourceDirectory,
    );
    await downloadGtfs(source.staticResourceHref, resourceDirectory);

    updateLog("%s ► Loading GTFS resource from '%s' into memory.", sourceId, resourceDirectory);
    const gtfs: Gtfs = {
      ...(await importGtfs(resourceDirectory, source.gtfsOptions)),
      ...(await getStaleness(source.staticResourceHref).catch(() => ({ lastModified: null, etag: null }))),
      importedAt: Temporal.Now.instant(),
    };

    const now = Temporal.Now.instant();
    const dates = [Temporal.Now.plainDateISO()];
    if (bootstrapping && Temporal.Now.zonedDateTimeISO().hour < 6) {
      dates.push(Temporal.Now.plainDateISO().subtract({ days: 1 }));
    }
    for (const trip of gtfs.trips.values()) {
      if (typeof source.allowScheduled === "function" && !source.allowScheduled(trip)) continue;

      const [today, yesterday] = dates;
      if (typeof yesterday !== "undefined") {
        const yesterdayJourney = trip.getScheduledJourney(yesterday);
        if (
          typeof yesterdayJourney !== "undefined" &&
          Temporal.Instant.compare(now, yesterdayJourney.calls.at(-1)!.aimedDepartureTime.toInstant()) < 0
        ) {
          gtfs.journeys.push(yesterdayJourney);
        }
      }

      const todayJourney = trip.getScheduledJourney(today!);
      if (
        typeof todayJourney !== "undefined" &&
        Temporal.Instant.compare(now, todayJourney.calls.at(-1)!.aimedDepartureTime.toInstant()) < 0
      ) {
        gtfs.journeys.push(todayJourney);
      }

      gtfs.journeys.sort(
        (a, b) => a.calls[0]!.aimedArrivalTime.epochSeconds - b.calls[0]!.aimedArrivalTime.epochSeconds,
      );
    }

    source.gtfs = gtfs;
    updateLog(
      "%s ✓ Load complete in %dms - %d oncoming journeys computed\n",
      sourceId,
      watch.total(),
      gtfs.journeys.length,
    );
  } catch (e) {
    updateLog("%s ✘ Load failed: '%s'.", sourceId, e instanceof Error ? e.message : e);
  }
}
