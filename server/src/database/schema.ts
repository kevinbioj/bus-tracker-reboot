import type { InferSelectModel } from "drizzle-orm";
import { char, integer, json, pgTable, serial, smallint, timestamp, varchar } from "drizzle-orm/pg-core";

export const networks = pgTable("network", {
  id: serial("id").primaryKey(),
  ref: varchar("ref").notNull().unique(),
  name: varchar("name").notNull(),
  authority: varchar("authority"),
  logoHref: varchar("logo_href"),
  color: char("color", { length: 6 }),
  textColor: char("text_color", { length: 6 }),
});

export type Network = InferSelectModel<typeof networks>;

export const operators = pgTable("operator", {
  id: serial("id").primaryKey(),
  ref: varchar("ref").notNull().unique(),
  name: varchar("name").notNull(),
  logoHref: varchar("logo_href"),
});

export type Operator = InferSelectModel<typeof operators>;

export const lines = pgTable("line", {
  id: serial("id").primaryKey(),
  networkId: integer("network_id")
    .notNull()
    .references(() => networks.id),
  ref: varchar("ref").notNull(),
  number: varchar("number").notNull(),
  cartridgeHref: varchar("cartridge_href"),
  color: char("color", { length: 6 }),
  textColor: char("text_color", { length: 6 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export type Line = InferSelectModel<typeof lines>;

export const girouettes = pgTable("girouette", {
  id: serial("id").primaryKey(),
  networkId: integer("network_id")
    .notNull()
    .references(() => networks.id),
  lineId: integer("line_id").references(() => lines.id),
  directionId: smallint("direction_id"),
  destinations: varchar("destinations").array(),
  data: json("data").notNull(),
});

export type Girouette = InferSelectModel<typeof girouettes>;

export const vehicles = pgTable("vehicle", {
  id: serial("id").primaryKey(),
  networkId: integer("network_id")
    .notNull()
    .references(() => networks.id),
  operatorId: integer("operator_id").references(() => operators.id),
  ref: varchar("ref").notNull(),
  designation: varchar("designation"),
  tcId: integer("tc_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export type Vehicle = InferSelectModel<typeof vehicles>;
