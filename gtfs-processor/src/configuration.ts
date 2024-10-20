import type { RedisClientOptions } from "redis";
import type { Temporal } from "temporal-polyfill";

import type { ImportGtfsOptions } from "./import/import-gtfs.js";
import type { TripUpdate, VehicleDescriptor, VehiclePosition } from "./model/gtfs-rt.js";
import type { Gtfs } from "./model/gtfs.js";
import type { Journey } from "./model/journey.js";
import type { Trip } from "./model/trip.js";

export type Configuration = {
  computeInterval: Temporal.Duration;
  redisOptions: RedisClientOptions;
  sources: Source[];
};

export type Source = {
  id: string;
  // --- Data provisioning
  staticResourceHref: string;
  realtimeResourceHrefs?: string[];
  gtfsOptions?: ImportGtfsOptions;
  // --- Additional data acquirance
  allowScheduled?: (trip: Trip) => boolean;
  getAheadTime?: (journey?: Journey) => number;
  getNetworkRef: (journey?: Journey, vehicle?: VehicleDescriptor) => string;
  getOperatorRef?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
  getVehicleRef?: (vehicle?: VehicleDescriptor) => string | undefined;
  // --- Data transformation
  mapLineRef?: (lineRef: string) => string;
  mapStopRef?: (stopRef: string) => string;
  mapTripRef?: (tripRef: string) => string;
  mapTripUpdate?: (tripUpdate: TripUpdate) => TripUpdate;
  mapVehiclePosition?: (vehicle: VehiclePosition) => VehiclePosition;
  // --- Runtime data
  gtfs?: Gtfs;
};

export async function loadConfiguration(name: string) {
  try {
    console.log("► Loading configuration '%s'.", name);
    const module = await import(`../configurations/${name}.mjs`);
    const configuration = module.default as Configuration;
    configuration.sources.forEach((source) =>
      console.log(
        `\tⓘ Loaded source '%s' with %d real-time feed(s).`,
        source.id,
        source.realtimeResourceHrefs?.length ?? 0,
      ),
    );
    console.log();
    return configuration;
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`Unable to find a configuration named '${name}'.`);
    }
    throw e;
  }
}
