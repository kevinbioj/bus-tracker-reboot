CREATE TABLE IF NOT EXISTS "girouette" (
	"id" serial PRIMARY KEY NOT NULL,
	"networkId" integer NOT NULL,
	"lineId" integer,
	"directionId" smallint,
	"destinations" varchar[],
	"data" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "line" (
	"id" serial PRIMARY KEY NOT NULL,
	"networkId" integer NOT NULL,
	"ref" varchar NOT NULL,
	"number" varchar NOT NULL,
	"cartridgeHref" varchar,
	"color" char(6),
	"textColor" char(6),
	"archivedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "network" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" varchar NOT NULL,
	"name" varchar NOT NULL,
	"authority" varchar,
	"color" char(6),
	"textColor" char(6),
	CONSTRAINT "network_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "girouette" ADD CONSTRAINT "girouette_networkId_network_id_fk" FOREIGN KEY ("networkId") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "girouette" ADD CONSTRAINT "girouette_lineId_line_id_fk" FOREIGN KEY ("lineId") REFERENCES "public"."line"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line" ADD CONSTRAINT "line_networkId_network_id_fk" FOREIGN KEY ("networkId") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
