import type { Temporal } from "temporal-polyfill";

import type { Agency } from "./agency.js";
import type { Journey } from "./journey.js";
import type { Route } from "./route.js";
import type { Service } from "./service.js";
import type { Stop } from "./stop.js";
import type { Trip } from "./trip.js";

export type Gtfs = {
  agencies: Map<string, Agency>;
  routes: Map<string, Route>;
  services: Map<string, Service>;
  stops: Map<string, Stop>;
  trips: Map<string, Trip>;
  // ---
  journeys: Journey[];
  // ---
  lastModified: string | null;
  etag: string | null;
  importedAt: Temporal.Instant;
};
