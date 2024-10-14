import type { InferSelectModel } from "drizzle-orm";
import { char, integer, json, pgTable, serial, smallint, timestamp, varchar } from "drizzle-orm/pg-core";

export const networks = pgTable("network", {
  id: serial().primaryKey(),
  ref: varchar().notNull().unique(),
  name: varchar().notNull(),
  authority: varchar(),
  color: char({ length: 6 }),
  textColor: char({ length: 6 }),
});

export type Network = InferSelectModel<typeof networks>;

export const lines = pgTable("line", {
  id: serial().primaryKey(),
  networkId: integer()
    .notNull()
    .references(() => networks.id),
  ref: varchar().notNull(),
  number: varchar().notNull(),
  cartridgeHref: varchar(),
  color: char({ length: 6 }),
  textColor: char({ length: 6 }),
  archivedAt: timestamp({ withTimezone: true }),
});

export type Line = InferSelectModel<typeof lines>;

export const girouettes = pgTable("girouette", {
  id: serial().primaryKey(),
  networkId: integer()
    .notNull()
    .references(() => networks.id),
  lineId: integer().references(() => lines.id),
  directionId: smallint(),
  destinations: varchar().array(),
  data: json().notNull(),
});

export type Girouette = InferSelectModel<typeof girouettes>;
