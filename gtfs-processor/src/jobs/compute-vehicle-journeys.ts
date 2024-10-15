import { Temporal } from "temporal-polyfill";

import { createPlainDate } from "../cache/temporal-cache.js";
import type { Source } from "../configuration.js";
import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import type { TripDescriptor } from "../model/gtfs-rt.js";
import type { Journey } from "../model/journey.js";
import type { Trip } from "../model/trip.js";
import type { VehicleJourney } from "../types/vehicle-journey.js";
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

const getCalls = (journey: Journey, at: Temporal.Instant, getAheadTime?: (journey: Journey) => number) => {
  const atWithMargin = at.add({ seconds: getAheadTime?.(journey) ?? 0 });

  const firstCall = journey.calls[0]!;
  if (atWithMargin.epochSeconds < (firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime).epochSeconds) return;

  const ongoingCalls = journey.calls.filter((call, index) => {
    return index === journey.calls.length - 1
      ? at.epochSeconds < (call.expectedArrivalTime ?? call.aimedArrivalTime).epochSeconds
      : at.epochSeconds < (call.expectedDepartureTime ?? call.aimedDepartureTime).epochSeconds;
  });
  if (ongoingCalls.length === 0) return;
  return ongoingCalls;
};

export async function computeVehicleJourneys(source: Source) {
  if (typeof source.gtfs === "undefined") return [];

  const now = Temporal.Now.instant();
  const watch = createStopWatch();
  const sourceId = padSourceId(source);
  const updateLog = console.draft(`%s     ► Generating active journeys list.`, sourceId);

  try {
    updateLog("%s 1/2 ► Downloading real-time data from feeds.", sourceId);
    const { tripUpdates, vehiclePositions } = await downloadGtfsRt(
      source.realtimeResourceHrefs ?? [],
      source.mapTripUpdate,
      source.mapVehiclePosition,
    );
    const downloadTime = watch.step();

    updateLog("%s 2/2 ► Computing active journeys.", sourceId);
    const activeJourneys = new Map<string, VehicleJourney>();
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

      const calls =
        typeof journey !== "undefined"
          ? typeof vehiclePosition.currentStopSequence !== "undefined"
            ? journey.calls.filter((call) => call.sequence >= vehiclePosition.currentStopSequence!)
            : typeof vehiclePosition.stopId !== "undefined"
              ? journey.calls.slice(journey.calls.findIndex((call) => call.stop.id === vehiclePosition.stopId))
              : getCalls(journey, now)
          : undefined;

      const key = `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehiclePosition.vehicle.id}`;
      activeJourneys.set(key, {
        id: key,
        ...(typeof journey !== "undefined"
          ? {
              line: {
                ref: `${source.getNetworkRef(journey)}:Line:${journey.trip.route.id}`,
                number: journey.trip.route.name,
                type: journey.trip.route.type,
                color: journey.trip.route.color,
                textColor: journey.trip.route.textColor,
              },
              direction: journey.trip.direction === 0 ? "OUTBOUND" : "INBOUND",
              destination: journey.trip.headsign,
              calls:
                calls?.map((call, index) => {
                  const isLast = index === calls.length - 1;
                  return {
                    aimedTime: isLast ? call.aimedArrivalTime : call.aimedDepartureTime,
                    expectedTime: isLast ? call.expectedArrivalTime : call.expectedDepartureTime,
                    stopId: call.stop.id,
                    stopName: call.stop.name,
                    stopOrder: call.sequence,
                    callStatus: call.status,
                  };
                }) ?? [],
            }
          : {}),
        position: {
          latitude: vehiclePosition.position.latitude,
          longitude: vehiclePosition.position.longitude,
          atStop: vehiclePosition.currentStatus === "STOPPED_AT",
          type: "GPS",
          recordedAt: Temporal.Instant.fromEpochSeconds(vehiclePosition.timestamp),
        },
        networkRef,
        journeyRef: journey?.trip.id,
        datedJourneyRef: journey?.id,
        operatorRef,
        vehicleRef,
        updatedAt: now,
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

      if (typeof journey.trip.block !== "undefined") {
        handledBlockIds.add(journey.trip.block);
      }

      const calls = getCalls(journey, now, source.getAheadTime);
      if (typeof calls === "undefined") continue;

      const key =
        typeof vehicleDescriptor !== "undefined"
          ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleDescriptor.id}`
          : `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${journey.id}`;
      activeJourneys.set(key, {
        id: key,
        line: {
          ref: `${source.getNetworkRef(journey, vehicleDescriptor)}:Line:${journey.trip.route.id}`,
          number: journey.trip.route.name,
          type: journey.trip.route.type,
          color: journey.trip.route.color,
          textColor: journey.trip.route.textColor,
        },
        direction: journey.trip.direction === 0 ? "OUTBOUND" : "INBOUND",
        destination: journey.trip.headsign,
        calls: calls.map((call, index) => {
          const isLast = index === calls.length - 1;
          return {
            aimedTime: isLast ? call.aimedArrivalTime : call.aimedDepartureTime,
            expectedTime: isLast ? call.expectedArrivalTime : call.expectedDepartureTime,
            stopId: call.stop.id,
            stopName: call.stop.name,
            stopOrder: call.sequence,
            callStatus: call.status,
          };
        }),
        position: journey.guessPosition(now),
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
      "%s     ✓ Computed %d journeys in %dms (%dms download - %dms compute).",
      sourceId,
      activeJourneys.size,
      watch.total(),
      downloadTime,
      computeTime,
    );
    return Array.from(activeJourneys.values());
  } catch (cause) {
    updateLog("%s     ✘ Something wrong occurred during computation.", sourceId);
    throw new Error(`Failed to compute vehicle journeys for '${source.id}'.`, { cause });
  }
}
