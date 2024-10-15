import { eq } from "drizzle-orm";

import { database } from "../database/database.js";
import { operators } from "../database/schema.js";

export async function importOperator(ref: string) {
  let [operator] = await database.select().from(operators).where(eq(operators.ref, ref));
  if (typeof operator === "undefined") {
    operator = (
      await database.insert(operators).values({
        ref,
        name: ref,
      })
    ).at(0)!;
  }
  return operator;
}
