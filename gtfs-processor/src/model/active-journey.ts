import type { Temporal } from "temporal-polyfill";

import type { JourneyPosition } from "./journey.js";
import type { RouteType } from "./route.js";

export type ActiveJourney = {
  id: string;
  line?: { id: string; number: string; type: RouteType };
  direction?: "OUTBOUND" | "INBOUND";
  destination?: string;
  calls?: Array<{
    aimedTime: Temporal.ZonedDateTime;
    expectedTime?: Temporal.ZonedDateTime;
    stopId: string;
    stopName: string;
    stopOrder: number;
    callStatus: "SCHEDULED" | "SKIPPED";
  }>;
  position: JourneyPosition;
  networkRef: string;
  journeyRef?: string;
  datedJourneyRef?: string;
  operatorRef?: string;
  vehicleRef?: string;
  updatedAt: Temporal.Instant;
};
