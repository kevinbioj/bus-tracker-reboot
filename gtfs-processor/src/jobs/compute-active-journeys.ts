import { Temporal } from "temporal-polyfill";

import { createPlainDate } from "../cache/temporal-cache.js";
import type { Source } from "../configuration.js";
import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import type { ActiveJourney } from "../model/active-journey.js";
import type { TripDescriptor } from "../model/gtfs-rt.js";
import type { Journey } from "../model/journey.js";
import type { Trip } from "../model/trip.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";

const matchTripAndTripUpdate = (trip: Trip, tripDescriptor: TripDescriptor) => {
  if (tripDescriptor.tripId !== trip.id) return false;
  if (typeof tripDescriptor.routeId !== "undefined" && tripDescriptor.routeId !== trip.route.id) return false;
  if (typeof tripDescriptor.directionId !== "undefined" && tripDescriptor.directionId !== trip.direction) return false;
  return true;
};

const matchJourneyAndTripUpdate = (journey: Journey, trip: TripDescriptor) => {
  if (trip.tripId !== journey.trip.id) return false;
  if (typeof trip.routeId !== "undefined" && trip.routeId !== journey.trip.route.id) return false;
  if (typeof trip.directionId !== "undefined" && trip.directionId !== journey.trip.direction) return false;
  if (typeof trip.startDate !== "undefined" && !createPlainDate(trip.startDate).equals(journey.date)) return false;
  return true;
};

export async function computeActiveJourneys(source: Source) {
  if (typeof source.gtfs === "undefined") return [];

  const now = Temporal.Now.instant();
  const watch = createStopWatch();
  const sourceId = padSourceId(source);
  const updateLog = console.draft(`%s ► Generating active journeys list.`, sourceId);

  updateLog("%s ► Downloading real-time data from feeds.", sourceId);
  const { tripUpdates, vehiclePositions } = await downloadGtfsRt(
    source.realtimeResourceHrefs ?? [],
    source.mapTripUpdate,
    source.mapVehiclePosition,
  );
  const downloadTime = watch.step();

  updateLog("%s ► Computing active journeys.", sourceId);
  const activeJourneys = new Map<string, ActiveJourney>();
  const handledJourneyIds = new Set<string>();
  const handledBlockIds = new Set<string>();

  for (const tripUpdate of tripUpdates) {
    if (now.since(Temporal.Instant.fromEpochSeconds(tripUpdate.timestamp)).total("minutes") >= 10) continue;

    let journey = source.gtfs.journeys.find((journey) => matchJourneyAndTripUpdate(journey, tripUpdate.trip));
    if (typeof journey === "undefined") {
      const trip =
        source.gtfs.trips.get(tripUpdate.trip.tripId) ??
        Array.from(source.gtfs.trips.values()).find((t) => matchTripAndTripUpdate(t, tripUpdate.trip));
      if (typeof trip !== "undefined") {
        journey = trip.getScheduledJourney(
          typeof tripUpdate.trip.startDate !== "undefined"
            ? Temporal.PlainDate.from(tripUpdate.trip.startDate)
            : Temporal.Now.plainDateISO(),
          true,
        );
        if (typeof journey !== "undefined") {
          source.gtfs.journeys.push(journey);
        }
      }
    }
    if (typeof journey !== "undefined") {
      journey.setTripUpdate(tripUpdate);
    }
  }

  for (const vehiclePosition of vehiclePositions) {
    let journey: Journey | undefined;

    if (typeof vehiclePosition.trip !== "undefined") {
      journey = source.gtfs.journeys.find((j) => matchJourneyAndTripUpdate(j, vehiclePosition.trip!));
      if (typeof journey !== "undefined") {
        if (now.since(Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp)).total("minutes") >= 10) {
          const lastCall = journey.calls.at(-1)!;
          if (
            Temporal.Instant.compare(now, (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).toInstant())
          ) {
            continue;
          }
        }
        handledJourneyIds.add(journey.id);
      }
    }

    const networkRef = source.getNetworkRef(journey, vehiclePosition.vehicle);
    const operatorRef = source.getOperatorRef?.(journey, vehiclePosition.vehicle);
    const vehicleRef =
      source.getVehicleRef?.(vehiclePosition.vehicle) ?? vehiclePosition.vehicle.label ?? vehiclePosition.vehicle.id;

    const key = `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehiclePosition.vehicle.id}`;
    activeJourneys.set(key, {
      id: key,
      ...(typeof journey !== "undefined"
        ? {
            line: { id: journey.trip.route.id, number: journey.trip.route.name, type: journey.trip.route.type },
            direction: journey.trip.direction === 0 ? "OUTBOUND" : "INBOUND",
            destination: journey.trip.headsign,
            calls:
              journey.getCalls(now, Infinity)?.map((ongoingCall, index, ongoingCalls) => {
                const isLast = index === ongoingCalls.length - 1;
                return {
                  aimedTime: isLast ? ongoingCall.aimedArrivalTime : ongoingCall.aimedDepartureTime,
                  expectedTime: isLast ? ongoingCall.expectedArrivalTime : ongoingCall.expectedDepartureTime,
                  stopId: ongoingCall.stop.id,
                  stopName: ongoingCall.stop.name,
                  stopOrder: ongoingCall.sequence,
                  callStatus: ongoingCall.status,
                };
              }) ?? [],
          }
        : {}),
      position: {
        latitude: vehiclePosition.position.latitude,
        longitude: vehiclePosition.position.longitude,
        type: "GPS",
        recordedAt: Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp),
      },
      networkRef,
      journeyRef: journey?.trip.id,
      datedJourneyRef: journey?.id,
      operatorRef,
      vehicleRef,
      updatedAt: Temporal.Now.instant(),
    });
  }

  for (const journey of source.gtfs.journeys) {
    if (handledJourneyIds.has(journey.id)) continue;
    if (typeof journey.trip.block !== "undefined" && handledBlockIds.has(journey.trip.block)) continue;
    if (typeof source.allowScheduled === "function" && !source.allowScheduled(journey.trip)) continue;

    const vehicleDescriptor = tripUpdates.find((tu) => matchJourneyAndTripUpdate(journey, tu.trip))?.vehicle;

    const networkRef = source.getNetworkRef(journey);
    const operatorRef = source.getOperatorRef?.(journey, vehicleDescriptor);
    const vehicleRef = source.getVehicleRef?.(vehicleDescriptor) ?? vehicleDescriptor?.label ?? vehicleDescriptor?.id;

    const ongoingCalls = journey.getCalls(now, source.getAheadTime?.(journey));
    if (typeof ongoingCalls === "undefined") continue;

    if (typeof journey.trip.block !== "undefined") {
      handledBlockIds.add(journey.trip.block);
    }

    const monitoredCall = ongoingCalls[0]!;

    const key =
      typeof vehicleDescriptor !== "undefined"
        ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleDescriptor.id}`
        : `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${journey.id}`;
    activeJourneys.set(key, {
      id: key,
      line: { id: journey.trip.route.id, number: journey.trip.route.name, type: journey.trip.route.type },
      direction: journey.trip.direction === 0 ? "OUTBOUND" : "INBOUND",
      destination: journey.trip.headsign,
      calls: ongoingCalls.map((ongoingCall, index) => {
        const isLast = index === ongoingCalls.length - 1;
        return {
          aimedTime: isLast ? ongoingCall.aimedArrivalTime : ongoingCall.aimedDepartureTime,
          expectedTime: isLast ? ongoingCall.expectedArrivalTime : ongoingCall.expectedDepartureTime,
          stopId: ongoingCall.stop.id,
          stopName: ongoingCall.stop.name,
          stopOrder: ongoingCall.sequence,
          callStatus: ongoingCall.status,
        };
      }),
      position: {
        latitude: monitoredCall.stop.latitude,
        longitude: monitoredCall.stop.longitude,
        type: "COMPUTED",
        recordedAt: (monitoredCall.expectedArrivalTime ?? monitoredCall.aimedArrivalTime).toInstant(),
      },
      networkRef,
      journeyRef: journey.trip.id,
      datedJourneyRef: journey.id,
      operatorRef,
      vehicleRef,
      updatedAt: now,
    });
  }

  const computeTime = watch.step();
  updateLog(
    "%s ✓ Computed %d journeys in %dms (%dms download - %dms compute).",
    sourceId,
    activeJourneys.size,
    watch.total(),
    downloadTime,
    computeTime,
  );
  return Array.from(activeJourneys.values());
}
