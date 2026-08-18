// Slice 1 schema: taxonomy plus the canonical catalogue and its sources.
//
// Only the tables slice 1 needs, per .forge/PLAN.md: taxonomy (franchise,
// category, provenance_type, identifier_kind), catalogue_item, variant,
// variant_identifier, source, verification, and permalink for the
// /i/{public_id}/{slug} resolution contract. attribute_def, attribute_option,
// category_attribute, bundle_component, item_attribute, variant_attribute and
// catalogue_photo are slice 2 and slice 5 scope and are not created here, so
// a later migration adds them rather than this slice inventing unused shape.
//
// created_by / verified_by are free-text labels, not a foreign key to
// user_account: that table does not exist until slice 3. Recorded here so the
// simplification is visible rather than silent.

import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  jsonb,
  varchar,
  char,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Layer 1: taxonomy and vocabulary
// ---------------------------------------------------------------------------

export const franchise = pgTable("franchise", {
  id: serial("id").primaryKey(),
  publicId: char("public_id", { length: 10 }).notNull().unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const category = pgTable(
  "category",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("category_parent_idx").on(t.parentId)],
);

// seeded: retail(sold, filled), promotional(pill), press(square),
// convention_exclusive(double rule), preorder_bonus(dashed).
// mark_style binds the design's provenance mark shape.
export const provenanceType = pgTable("provenance_type", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  labelKey: varchar("label_key", { length: 80 }).notNull(),
  isSold: boolean("is_sold").notNull(),
  markStyle: varchar("mark_style", { length: 40 }).notNull(),
  sort: integer("sort").notNull().default(0),
});

// seeded: barcode_ean13, barcode_upca, catalogue_number, sku, matrix_runout,
// asin, isbn, part_number. validator names the check-digit routine, if any.
export const identifierKind = pgTable("identifier_kind", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  labelKey: varchar("label_key", { length: 80 }).notNull(),
  validator: varchar("validator", { length: 40 }),
});

// ---------------------------------------------------------------------------
// Layer 2: canonical catalogue, community-edited
// ---------------------------------------------------------------------------

export const catalogueItem = pgTable(
  "catalogue_item",
  {
    id: serial("id").primaryKey(),
    publicId: char("public_id", { length: 10 }).notNull().unique(),
    slug: varchar("slug", { length: 160 }).notNull(),
    franchiseId: integer("franchise_id")
      .notNull()
      .references(() => franchise.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    releaseYear: integer("release_year"),
    copyrightYear: integer("copyright_year"),
    publisher: text("publisher"),
    developer: text("developer"),
    descriptionMd: text("description_md"),
    attrs: jsonb("attrs").notNull().default({}),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    mergedIntoId: integer("merged_into_id"),
    revision: integer("revision").notNull().default(1),
    createdBy: varchar("created_by", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("catalogue_item_franchise_idx").on(t.franchiseId),
    index("catalogue_item_category_idx").on(t.categoryId),
    index("catalogue_item_updated_idx").on(t.updatedAt),
    // Lets the seed loader re-run without duplicating an item: the natural
    // key is a slug within its franchise, minted once alongside the public id.
    uniqueIndex("catalogue_item_franchise_slug_idx").on(t.franchiseId, t.slug),
  ],
);

export const variant = pgTable(
  "variant",
  {
    id: serial("id").primaryKey(),
    publicId: char("public_id", { length: 10 }).notNull().unique(),
    catalogueItemId: integer("catalogue_item_id")
      .notNull()
      .references(() => catalogueItem.id),
    name: text("name").notNull(),
    provenanceTypeId: integer("provenance_type_id")
      .notNull()
      .references(() => provenanceType.id),
    regionNote: text("region_note"),
    releaseDate: date("release_date"),
    printRun: integer("print_run"),
    editionNumber: text("edition_number"),
    attrs: jsonb("attrs").notNull().default({}),
    status: varchar("status", { length: 20 }).notNull().default("published"),
    mergedIntoId: integer("merged_into_id"),
    revision: integer("revision").notNull().default(1),
    createdBy: varchar("created_by", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("variant_item_idx").on(t.catalogueItemId),
    index("variant_provenance_idx").on(t.provenanceTypeId),
    index("variant_updated_idx").on(t.updatedAt),
    uniqueIndex("variant_item_name_idx").on(t.catalogueItemId, t.name),
  ],
);

// normalized is generated so a barcode "978-0-13" and "9780013" collide on
// lookup the same way a scanner and a keyboard would produce them. NOT
// unique: two variants sharing a barcode is exactly the UNCERTAIN verdict.
export const variantIdentifier = pgTable(
  "variant_identifier",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variant.id),
    identifierKindId: integer("identifier_kind_id")
      .notNull()
      .references(() => identifierKind.id),
    value: text("value").notNull(),
    normalized: text("normalized").generatedAlwaysAs(
      sql`lower(regexp_replace(value, '[^a-zA-Z0-9]', '', 'g'))`,
    ),
    sourceId: integer("source_id").references(() => source.id),
  },
  (t) => [
    index("variant_identifier_normalized_idx").on(t.normalized),
    index("variant_identifier_variant_idx").on(t.variantId),
  ],
);

// ---------------------------------------------------------------------------
// Layer 3: sources and verification
// ---------------------------------------------------------------------------

// kind: primary_scan | publisher_page | retailer_archive | press_archive |
// auction_lot | photograph | database_entry
export const source = pgTable("source", {
  id: serial("id").primaryKey(),
  kind: varchar("kind", { length: 40 }).notNull(),
  url: text("url").notNull(),
  title: text("title"),
  publisher: text("publisher"),
  retrievedOn: date("retrieved_on").notNull(),
  note: text("note"),
});

// method: in_hand_photograph | publisher_archive | retailer_archive |
// press_archive | auction_lot_record | two_independent_databases
export const verification = pgTable(
  "verification",
  {
    id: serial("id").primaryKey(),
    targetTable: varchar("target_table", { length: 40 }).notNull(),
    targetId: integer("target_id").notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => source.id),
    verifiedOn: date("verified_on").notNull(),
    verifiedBy: varchar("verified_by", { length: 80 }),
    note: text("note"),
  },
  (t) => [
    index("verification_target_idx").on(t.targetTable, t.targetId),
    uniqueIndex("verification_target_unique_idx").on(
      t.targetTable,
      t.targetId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Permalinks: /i/{public_id}/{slug} resolves through here so a merge or a
// rename redirects forever and nothing 404s.
// ---------------------------------------------------------------------------

export const permalink = pgTable("permalink", {
  id: serial("id").primaryKey(),
  publicId: char("public_id", { length: 10 }).notNull().unique(),
  targetTable: varchar("target_table", { length: 40 }).notNull(),
  targetId: integer("target_id").notNull(),
  isCanonical: boolean("is_canonical").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// client_op: write idempotency for the offline outbox. Belongs to slice 1's
// offline boundary even though user_account (slice 3) does not exist yet, so
// userId is nullable and carries the anonymous device id string in v1.
// ---------------------------------------------------------------------------

export const clientOp = pgTable(
  "client_op",
  {
    id: char("id", { length: 36 }).primaryKey(),
    deviceId: varchar("device_id", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    payload: jsonb("payload").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("client_op_device_idx").on(t.deviceId)],
);

// ---------------------------------------------------------------------------
// sync_epoch: a single, stamped row the delta feed
// (src/app/api/sync/index/route.ts) compares against the epoch every synced
// device carries. Measured 2026-08-18: the server was re-seeded from empty
// (docker compose down -v; migrate; seed), minting fresh public_ids for the
// same catalogue, and a device that had already synced kept all 123 of its
// old rows against 74 live variants because nothing told it the catalogue
// had been rebuilt wholesale, producing a phantom duplicate match inside
// UNCERTAIN. The migration that creates this table inserts its one row with
// a freshly random value, so a full local reset -- which necessarily
// re-applies every migration from empty -- mints a new epoch as a side
// effect, with no script required to remember to bump it. Production
// applies this migration exactly once and the epoch is then stable for the
// life of that database. A client whose stored epoch does not match this
// value gets a forced full resync instead of a delta (see the route), which
// converges it to server truth with no human clearing storage.
// ---------------------------------------------------------------------------

export const syncEpoch = pgTable("sync_epoch", {
  id: integer("id").primaryKey(),
  epoch: varchar("epoch", { length: 36 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

