import { drizzle } from "drizzle-orm/connect";

import * as schema from "./schema.js";

export const database = await drizzle("postgres-js", {
  casing: "snake_case",
  connection: process.env.DATABASE_URL!,
  schema,
});
