import { and, eq } from "drizzle-orm";

import { database } from "../database/database.js";
import { networks, operators, vehicles } from "../database/schema.js";

import { importNetwork } from "./import-network.js";
import { importOperator } from "./import-operator.js";

export async function importVehicle(networkRef: string, vehicleRef: string, operatorRef?: string) {
  const network = await importNetwork(networkRef);
  const operator = operatorRef ? await importOperator(operatorRef) : undefined;

  let [vehicle] = await database
    .select()
    .from(vehicles)
    .where(
      operator
        ? and(eq(networks.id, network.id), eq(operators.id, operator.id), eq(vehicles.ref, vehicleRef))
        : and(eq(networks.id, network.id), eq(vehicles.ref, vehicleRef)),
    );
  if (typeof vehicle === "undefined") {
    vehicle = (
      await database.insert(vehicles).values({
        networkId: network.id,
        operatorId: operator?.id,
        ref: vehicleRef,
      })
    ).at(0)!;
  }

  return vehicle;
}
