import { Temporal } from "temporal-polyfill";

import type { TripUpdate } from "./gtfs-rt.js";
import type { Stop } from "./stop.js";
import type { Trip } from "./trip.js";

export type JourneyCall = {
  aimedArrivalTime: Temporal.ZonedDateTime;
  expectedArrivalTime?: Temporal.ZonedDateTime;
  aimedDepartureTime: Temporal.ZonedDateTime;
  expectedDepartureTime?: Temporal.ZonedDateTime;
  stop: Stop;
  sequence: number;
  status: "SCHEDULED" | "SKIPPED";
};

export class Journey {
  constructor(
    readonly id: string,
    readonly trip: Trip,
    readonly date: Temporal.PlainDate,
    readonly calls: JourneyCall[],
  ) {}

  getCalls(at: Temporal.Instant, aheadTime = 0) {
    const firstCall = this.calls[0]!;
    if (at.epochSeconds + aheadTime < (firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime).epochSeconds)
      return;

    const lastCall = this.calls.at(-1)!;
    if (at.epochSeconds > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).epochSeconds) return;

    const nextCallIndex = this.calls.findIndex(
      (call) => at.epochSeconds < (call.expectedArrivalTime ?? call.aimedArrivalTime).epochSeconds,
    );
    return this.calls.slice(nextCallIndex > 0 ? nextCallIndex - 1 : 0);
  }

  setTripUpdate(tripUpdate: TripUpdate) {
    let arrivalDelay: number | undefined;
    let departureDelay: number | undefined;

    for (const call of this.calls) {
      const timeUpdate = tripUpdate.stopTimeUpdate?.find(
        (stu) => stu.stopSequence === call.sequence || stu.stopId === call.stop.id,
      );

      if (timeUpdate?.scheduleRelationship === "NO_DATA") {
        arrivalDelay = undefined;
        departureDelay = undefined;
        continue;
      }

      if (timeUpdate?.scheduleRelationship === "SKIPPED") {
        call.expectedArrivalTime = call.aimedArrivalTime.add({ seconds: arrivalDelay ?? 0 });
        call.expectedDepartureTime = call.aimedArrivalTime.add({ seconds: departureDelay ?? 0 });
        call.status = "SKIPPED";
        continue;
      }

      // Ce n'est pas un concept évident à comprendre pour certains producteurs que
      // de remplir ces champs avec les neuronnes qui communiquent correctement.
      const arrivalEvent = timeUpdate?.arrival ?? timeUpdate?.departure;
      const departureEvent = timeUpdate?.departure ?? timeUpdate?.arrival;

      if (typeof arrivalEvent?.time === "number") {
        arrivalDelay = arrivalEvent.time - call.aimedArrivalTime.epochSeconds;
      } else if (typeof arrivalEvent?.delay === "number") {
        arrivalDelay = arrivalEvent.delay;
      }

      if (typeof departureEvent?.time === "number") {
        departureDelay = departureEvent.time - call.aimedDepartureTime.epochSeconds;
      } else if (typeof departureEvent?.delay === "number") {
        departureDelay = departureEvent.delay;
      }

      call.expectedArrivalTime = call.aimedArrivalTime.add({ seconds: arrivalDelay ?? 0 });
      call.expectedDepartureTime = call.aimedDepartureTime.add({ seconds: departureDelay ?? 0 });
    }
  }
}
