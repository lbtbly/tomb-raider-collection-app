// The documented shape of .forge/research/seed-starter.json. Built ahead of
// the file landing, per .forge/PLAN.md: "items, each with variants, each
// variant carrying identifiers with a source_id and a verification block
// naming a method." R10 additionally requires a linked source and a
// verification row on the item and the variant, not only the identifier, so
// both levels carry their own source and verification here too.
//
// If the real file's header documents a different shape when it lands, this
// module is the one place that changes; loader.ts consumes only these types.

import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const sourceKinds = [
  "primary_scan",
  "publisher_page",
  "retailer_archive",
  "press_archive",
  "auction_lot",
  "photograph",
  "database_entry",
] as const;

export const verificationMethods = [
  "in_hand_photograph",
  "publisher_archive",
  "retailer_archive",
  "press_archive",
  "auction_lot_record",
  "two_independent_databases",
] as const;

export const seedSourceSchema = z.object({
  kind: z.enum(sourceKinds),
  url: z.string().url(),
  title: z.string().optional(),
  publisher: z.string().optional(),
  retrieved_on: isoDate,
  note: z.string().optional(),
});

export const seedVerificationSchema = z.object({
  method: z.enum(verificationMethods),
  verified_on: isoDate,
  verified_by: z.string(),
  note: z.string().optional(),
});

export const seedIdentifierSchema = z.object({
  kind: z.enum([
    "barcode_ean13",
    "barcode_upca",
    "catalogue_number",
    "sku",
    "matrix_runout",
    "asin",
    "isbn",
    "part_number",
  ]),
  value: z.string().min(1),
  source: seedSourceSchema,
  verification: seedVerificationSchema,
});

export const seedVariantSchema = z.object({
  name: z.string().min(1),
  provenance_type: z.enum([
    "retail",
    "promotional",
    "press",
    "convention_exclusive",
    "preorder_bonus",
  ]),
  region_note: z.string().optional(),
  release_date: isoDate.optional(),
  print_run: z.number().int().positive().optional(),
  edition_number: z.string().optional(),
  source: seedSourceSchema,
  verification: seedVerificationSchema,
  identifiers: z.array(seedIdentifierSchema).default([]),
});

export const seedItemSchema = z.object({
  franchise: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  release_year: z.number().int().optional(),
  copyright_year: z.number().int().optional(),
  publisher: z.string().optional(),
  developer: z.string().optional(),
  description_md: z.string().optional(),
  source: seedSourceSchema,
  verification: seedVerificationSchema,
  variants: z.array(seedVariantSchema).min(1),
});

export const seedDocumentSchema = z.object({
  $schema: z.literal("vitrine.seed-starter.v1"),
  items: z.array(seedItemSchema).min(1),
});

export type SeedDocument = z.infer<typeof seedDocumentSchema>;
export type SeedItem = z.infer<typeof seedItemSchema>;
export type SeedVariant = z.infer<typeof seedVariantSchema>;
export type SeedIdentifier = z.infer<typeof seedIdentifierSchema>;
