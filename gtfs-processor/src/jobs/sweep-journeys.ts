import { Temporal } from "temporal-polyfill";

import type { Source } from "../source.js";

export function sweepJourneys(source: Source) {
  if (typeof source.gtfs === "undefined") return;

  console.log("► Sweeping completed journeys for '%s'.", source.id);
  const now = Temporal.Now.instant().epochSeconds;
  const oldJourneyCount = source.gtfs.journeys.length;
  source.gtfs.journeys = source.gtfs.journeys.filter((journey) => {
    const lastCall = journey.calls.at(-1)!;
    return now <= (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).epochSeconds;
  });
  console.log("✓ Swept a total of %d completed journeys!\n", oldJourneyCount - source.gtfs.journeys.length);
}
