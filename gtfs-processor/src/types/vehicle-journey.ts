import type { Temporal } from "temporal-polyfill";

import type { JourneyPosition } from "../model/journey.js";

export type VehicleJourneyDirection = "OUTBOUND" | "INBOUND";
export type VehicleJourneyLineType = "TRAMWAY" | "SUBWAY" | "RAIL" | "BUS" | "FERRY" | "COACH" | "UNKNOWN";

export type VehicleJourneyLine = {
  ref: string;
  number: string;
  type: VehicleJourneyLineType;
  color?: string;
  textColor?: string;
};

export type VehicleJourneyCall = {
  aimedTime: Temporal.ZonedDateTime;
  expectedTime?: Temporal.ZonedDateTime;
  stopRef: string;
  stopName: string;
  stopOrder: number;
  callStatus: "SCHEDULED" | "SKIPPED";
};

export type VehicleJourney = {
  id: string;
  line?: VehicleJourneyLine;
  direction?: VehicleJourneyDirection;
  destination?: string;
  calls?: VehicleJourneyCall[];
  position: JourneyPosition;
  networkRef: string;
  journeyRef?: string;
  datedJourneyRef?: string;
  operatorRef?: string;
  vehicleRef?: string;
  updatedAt: Temporal.Instant;
};
