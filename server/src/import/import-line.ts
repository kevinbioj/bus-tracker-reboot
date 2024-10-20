import { and, eq } from "drizzle-orm";

import { database } from "../database/database.js";
import { lines } from "../database/schema.js";
import type { VehicleJourneyLine } from "../types/vehicle-journey.js";

import { importNetwork } from "./import-network.js";

export async function importLine(networkRef: string, lineData: VehicleJourneyLine) {
  const network = await importNetwork(networkRef);
  let [line] = await database
    .select()
    .from(lines)
    .where(and(eq(lines.networkId, network.id), eq(lines.ref, lineData.ref)));
  if (typeof line === "undefined") {
    line = (
      await database
        .insert(lines)
        .values({
          networkId: network.id,
          ref: lineData.ref,
          number: lineData.number,
          color: lineData.color,
          textColor: lineData.textColor,
        })
        .returning()
    ).at(0)!;
  }
  return lines;
}
