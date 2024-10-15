import pLimit from "p-limit";

import { importVehicle } from "../import/import-vehicle.js";
import type { VehicleJourney } from "../types/vehicle-journey.js";

const registerFn = pLimit(1);

export function registerActivity(journey: VehicleJourney) {
  return registerFn(() => _registerActivity(journey));
}

async function _registerActivity(journey: VehicleJourney) {
  if (typeof journey.line === "undefined" || typeof journey.vehicleRef === "undefined") return;

  await importVehicle(journey.networkRef, journey.vehicleRef, journey.operatorRef);

  return void 0;
}
