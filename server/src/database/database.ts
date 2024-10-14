import { drizzle } from "drizzle-orm/connect";

export const database = await drizzle("postgres-js", process.env.DATABASE_URL!);
