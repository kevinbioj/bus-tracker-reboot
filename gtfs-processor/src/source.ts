import type { TripUpdate, VehicleDescriptor, VehiclePosition } from "./model/gtfs-rt.js";
import type { Gtfs } from "./model/gtfs.js";
import type { Journey } from "./model/journey.js";
import type { Trip } from "./model/trip.js";

export type Source = {
  id: string;
  // --- Data provisioning
  staticResourceHref: string;
  realtimeResourceHrefs?: string[];
  // --- Additional data acquirance
  allowScheduled?: (trip: Trip) => boolean;
  getAheadTime?: (journey?: Journey) => number;
  getNetworkRef: (journey?: Journey, vehicle?: VehicleDescriptor) => string;
  getOperatorRef?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
  getVehicleRef?: (vehicle?: VehicleDescriptor) => string | undefined;
  // --- Data transformation
  mapTripUpdate?: (tripUpdate: TripUpdate) => TripUpdate;
  mapVehiclePosition?: (vehicle: VehiclePosition) => VehiclePosition;
  // --- Runtime data
  gtfs?: Gtfs;
};

export async function loadConfiguration(name: string) {
  try {
    console.log("► Loading configuration '%s'.", name);
    const module = await import(`../configurations/${name}.mjs`);
    const sources = module.default as Source[];
    sources.forEach((source) =>
      console.log(
        `\tⓘ Loaded source '%s' with %d real-time feed(s).`,
        source.id,
        source.realtimeResourceHrefs?.length ?? 0,
      ),
    );
    console.log(`✓ Loaded %d sources!\n`, sources.length);
    return sources;
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`Unable to find a configuration named '${name}'.`);
    }
    throw e;
  }
}
