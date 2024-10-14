import pLimit from "p-limit";

import type { VehicleJourney } from "../types/vehicle-journey.js";

// import { importLine } from "../import/import-line.js";

const registerFn = pLimit(1);

export const registerActivity = (journey: VehicleJourney) => registerFn(() => _registerActivity(journey));

async function _registerActivity(journey: VehicleJourney) {
  if (typeof journey.line === "undefined") return;

  // const line = await importLine(journey.networkRef, journey.line);

  return void 0;
}
