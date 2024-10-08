import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import { createPlainDate, createPlainTime } from "../cache/temporal-cache.js";
import { Agency } from "../model/agency.js";
import { Route, routeTypes } from "../model/route.js";
import { Service } from "../model/service.js";
import { StopTime } from "../model/stop-time.js";
import { Stop } from "../model/stop.js";
import { Trip } from "../model/trip.js";
import { type CsvRecord, readCsv } from "../utils/csv-reader.js";
import { fileExists } from "../utils/file-exists.js";

export async function importGtfs(gtfsDirectory: string) {
  const [agencies, services, stops] = await Promise.all([
    importAgencies(gtfsDirectory),
    importServices(gtfsDirectory),
    importStops(gtfsDirectory),
  ]);
  const routes = await importRoutes(gtfsDirectory, agencies);
  const trips = await importTrips(gtfsDirectory, routes, services, stops);
  return { agencies, routes, services, stops, trips, journeys: [] };
}

// ---

type AgencyRecord = CsvRecord<"agency_id" | "agency_name" | "agency_timezone">;

async function importAgencies(gtfsDirectory: string) {
  const agencies = new Map<string, Agency>();

  await readCsv<AgencyRecord>(join(gtfsDirectory, "agency.txt"), (agencyRecord) => {
    const agency = new Agency(
      agencyRecord.agency_id,
      agencyRecord.agency_name,
      new Temporal.TimeZone(agencyRecord.agency_timezone),
    );

    agencies.set(agency.id, agency);
  });

  return agencies;
}

type ServiceRecord = CsvRecord<
  | "service_id"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"
  | "start_date"
  | "end_date"
>;

type ExceptionRecord = CsvRecord<"service_id" | "date" | "exception_type">;

async function importServices(gtfsDirectory: string) {
  const services = new Map<string, Service>();

  const calendarFile = join(gtfsDirectory, "calendar.txt");
  if (await fileExists(calendarFile)) {
    await readCsv<ServiceRecord>(calendarFile, (serviceRecord) => {
      const service = new Service(
        serviceRecord.service_id,
        [
          !!+serviceRecord.monday,
          !!+serviceRecord.tuesday,
          !!+serviceRecord.wednesday,
          !!+serviceRecord.thursday,
          !!+serviceRecord.friday,
          !!+serviceRecord.saturday,
          !!+serviceRecord.sunday,
        ],
        createPlainDate(serviceRecord.start_date),
        createPlainDate(serviceRecord.end_date),
      );

      services.set(service.id, service);
    });
  }

  const calendarDatesFile = join(gtfsDirectory, "calendar_dates.txt");
  if (await fileExists(calendarDatesFile)) {
    await readCsv<ExceptionRecord>(calendarDatesFile, (exceptionRecord) => {
      let service = services.get(exceptionRecord.service_id);
      if (typeof service === "undefined") {
        service = new Service(exceptionRecord.service_id);
        services.set(service.id, service);
      }

      const date = createPlainDate(exceptionRecord.date);
      if (exceptionRecord.exception_type === "1") {
        service.includedDates.push(date);
      } else {
        service.excludedDates.push(date);
      }
    });
  }

  return services;
}

type StopRecord = CsvRecord<"stop_id" | "stop_name" | "stop_lat" | "stop_lon", "location_type">;

async function importStops(gtfsDirectory: string) {
  const stops = new Map<string, Stop>();

  await readCsv<StopRecord>(join(gtfsDirectory, "stops.txt"), (stopRecord) => {
    if (
      typeof stopRecord.location_type !== "undefined" &&
      stopRecord.location_type !== "" &&
      stopRecord.location_type !== "0"
    ) {
      return;
    }

    const stop = new Stop(stopRecord.stop_id, stopRecord.stop_name, +stopRecord.stop_lat, +stopRecord.stop_lon);

    stops.set(stop.id, stop);
  });

  return stops;
}

type RouteRecord = CsvRecord<
  "route_id" | "agency_id" | "route_short_name" | "route_type",
  "route_color" | "route_text_color"
>;

async function importRoutes(gtfsDirectory: string, agencies: Map<string, Agency>) {
  const routes = new Map<string, Route>();

  await readCsv<RouteRecord>(join(gtfsDirectory, "routes.txt"), (routeRecord) => {
    const agency = agencies.get(routeRecord.agency_id);
    if (typeof agency === "undefined") {
      throw new Error(`Unknown agency with id '${routeRecord.agency_id}' for route '${routeRecord.route_id}'.`);
    }

    const route = new Route(
      routeRecord.route_id,
      agency,
      routeRecord.route_short_name,
      routeRecord.route_type in routeTypes ? routeTypes[routeRecord.route_type as keyof typeof routeTypes] : "UNKNOWN",
      routeRecord.route_color?.toUpperCase(),
      routeRecord.route_text_color?.toUpperCase(),
    );

    routes.set(route.id, route);
  });

  return routes;
}

type TripRecord = CsvRecord<"trip_id" | "route_id" | "service_id" | "direction_id", "trip_headsign" | "block_id">;
type StopTimeRecord = CsvRecord<"trip_id" | "arrival_time" | "departure_time" | "stop_sequence" | "stop_id">;

async function importTrips(
  gtfsDirectory: string,
  routes: Map<string, Route>,
  services: Map<string, Service>,
  stops: Map<string, Stop>,
) {
  const trips = new Map<string, Trip>();

  await readCsv<TripRecord>(join(gtfsDirectory, "trips.txt"), (tripRecord) => {
    const route = routes.get(tripRecord.route_id);
    if (typeof route === "undefined") {
      throw new Error(`Unknown route with id '${tripRecord.route_id}' for trip '${tripRecord.trip_id}'.`);
    }

    const service = services.get(tripRecord.service_id);
    if (typeof service === "undefined") {
      throw new Error(`Unknown service with id '${tripRecord.service_id}' for trip '${tripRecord.trip_id}'.`);
    }

    const trip = new Trip(
      tripRecord.trip_id,
      route,
      service,
      [],
      +tripRecord.direction_id as 0 | 1,
      tripRecord.trip_headsign || undefined,
      tripRecord.block_id || undefined,
    );

    trips.set(trip.id, trip);
  });

  await readCsv<StopTimeRecord>(join(gtfsDirectory, "stop_times.txt"), (stopTimeRecord) => {
    const trip = trips.get(stopTimeRecord.trip_id);
    if (typeof trip === "undefined") {
      throw new Error(
        `Unknown trip with id '${stopTimeRecord.trip_id}' for {${stopTimeRecord.stop_sequence}/${stopTimeRecord.stop_id}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
      );
    }

    const stop = stops.get(stopTimeRecord.stop_id);
    if (typeof stop === "undefined") {
      throw new Error(
        `Unknown stop with id '${stopTimeRecord.stop_id}' for {${stopTimeRecord.stop_sequence}/${stopTimeRecord.stop_id}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
      );
    }

    const arrivalHours = +stopTimeRecord.arrival_time.slice(0, 2);
    const departureHours = +stopTimeRecord.departure_time.slice(0, 2);

    const mismatchingTimes = stopTimeRecord.arrival_time !== stopTimeRecord.departure_time;

    const stopTime = new StopTime(
      +stopTimeRecord.stop_sequence,
      stop,
      createPlainTime(`${(arrivalHours % 24).toString().padStart(2, "0")}:${stopTimeRecord.arrival_time.slice(3)}`),
      Math.floor(arrivalHours / 24),
      mismatchingTimes
        ? createPlainTime(
            `${(departureHours % 24).toString().padStart(2, "0")}:${stopTimeRecord.departure_time.slice(3)}`,
          )
        : undefined,
      mismatchingTimes ? Math.floor(departureHours / 24) : undefined,
    );

    trip.stopTimes.push(stopTime);
  });

  for (const trip of trips.values()) {
    trip.stopTimes.sort((a, b) => a.sequence - b.sequence);
  }

  return trips;
}
