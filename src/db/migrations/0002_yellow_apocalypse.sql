CREATE TABLE "sync_epoch" (
	"id" integer PRIMARY KEY NOT NULL,
	"epoch" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- One row, minted fresh every time this migration runs against an empty
-- database. A normal deploy applies it once and the epoch is then stable
-- for the life of that database; a full local reset (docker compose down
-- -v; migrate; seed) necessarily re-applies it too, which is exactly the
-- signal src/app/api/sync/index/route.ts uses to force a full resync on a
-- device carrying the old epoch, instead of it silently keeping rows for
-- variants that no longer exist under those public_ids.
INSERT INTO "sync_epoch" ("id", "epoch") VALUES (1, gen_random_uuid()::text);
