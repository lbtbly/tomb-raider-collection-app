// Loads a validated SeedDocument into the database. Never invents a row:
// every catalogue_item, variant and variant_identifier it writes carries the
// source and verification the document supplied. Taxonomy (franchise,
// category, provenance_type, identifier_kind) must already be seeded; an
// unresolved slug or key throws rather than silently creating one, because a
// silently-created franchise or category is exactly the kind of unverified
// row R10 exists to catch.
//
// The loader MERGES. A document naming an item the database already holds
// adds the variants that item does not yet have, and adds the identifiers a
// matched variant does not yet have. It never rewrites a catalogue_item,
// variant or variant_identifier row it did not create in this run: matching
// is how a second pass deepens the catalogue, not how it overwrites one.
//
// Idempotency is the whole game here and this seam has broken twice. Loading
// the same document twice must insert nothing. Loading a document that adds
// one variant must insert exactly that one variant, and loading THAT document
// again must insert nothing. Both prior defects were the same mistake in
// different clothes -- treating absence of information as information -- so
// every identity rule below is written to answer "is this the same object",
// never "is this string free".

import { eq, and, isNull } from "drizzle-orm";
import type { db as DbType } from "../index";
import {
  franchise,
  category,
  provenanceType,
  identifierKind,
  catalogueItem,
  variant,
  variantIdentifier,
  source,
  verification,
  permalink,
} from "../schema";
import { insertWithFreshPublicId } from "@/lib/id/public-id";
import { slugify } from "@/lib/id/slug";
import { normalizeIdentifier } from "@/lib/identifiers/normalize";
import type {
  SeedDocument,
  SeedVariant,
  SeedIdentifier,
  seedSourceSchema,
  seedVerificationSchema,
} from "./seed-document";
import type { z } from "zod";

type Source = z.infer<typeof seedSourceSchema>;
type Verification = z.infer<typeof seedVerificationSchema>;

type Db = typeof DbType;

export type LoadResult = {
  itemsInserted: number;
  itemsSkippedExisting: number;
  variantsInserted: number;
  variantsSkippedExisting: number;
  identifiersInserted: number;
  identifiersSkippedExisting: number;
  sourcesInserted: number;
  sourcesReused: number;
  verificationsInserted: number;
  verificationsStrengthened: number;
  verificationsSkippedWeaker: number;
};

// How much a verification method is worth when two of them land on the same
// row and only one link survives. Ordered strongest first: the operator
// holding the object beats the publisher's own record of it, which beats a
// single sold copy, which beats a magazine, which beats a shop listing,
// which beats two other databases agreeing with each other. The rubric names
// in_hand_photograph the strongest tier; the rest of the ordering follows how
// close the evidence stands to the physical object.
const VERIFICATION_STRENGTH: Record<string, number> = {
  in_hand_photograph: 6,
  publisher_archive: 5,
  auction_lot_record: 4,
  press_archive: 3,
  retailer_archive: 2,
  two_independent_databases: 1,
};

function strengthOf(method: string): number {
  return VERIFICATION_STRENGTH[method] ?? 0;
}

// A variant name compared the way a human would compare two labels: case and
// surrounding or repeated whitespace are formatting, not identity. Kept
// deliberately coarser than the database's own unique index on
// (catalogue_item_id, name), which is exact. Coarser is safe -- it merges
// "Greatest Hits" into "Greatest hits" instead of inserting a second row the
// index would reject. Finer would not be.
function variantIdentityKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function loadSeedDocument(
  db: Db,
  doc: SeedDocument,
  // Recorded on every catalogue_item and variant row as created_by, so a
  // fixture-origin row is programmatically distinguishable from a row loaded
  // from the real .forge/research/seed-starter.json, not only distinguishable
  // by reading its title.
  originLabel: string = "seed:seed-starter.json",
): Promise<LoadResult> {
  const result: LoadResult = {
    itemsInserted: 0,
    itemsSkippedExisting: 0,
    variantsInserted: 0,
    variantsSkippedExisting: 0,
    identifiersInserted: 0,
    identifiersSkippedExisting: 0,
    sourcesInserted: 0,
    sourcesReused: 0,
    verificationsInserted: 0,
    verificationsStrengthened: 0,
    verificationsSkippedWeaker: 0,
  };

  const franchiseCache = new Map<string, number>();
  const categoryCache = new Map<string, number>();
  const provenanceCache = new Map<string, number>();
  const identifierKindCache = new Map<string, number>();
  const sourceCache = new Map<string, number>();

  async function resolveFranchise(slug: string): Promise<number> {
    if (franchiseCache.has(slug)) return franchiseCache.get(slug)!;
    const row = await db.query.franchise.findFirst({
      where: eq(franchise.slug, slug),
    });
    if (!row)
      throw new Error(
        `Unknown franchise slug "${slug}". Seed taxonomy before loading the catalogue.`,
      );
    franchiseCache.set(slug, row.id);
    return row.id;
  }

  async function resolveCategory(slug: string): Promise<number> {
    if (categoryCache.has(slug)) return categoryCache.get(slug)!;
    const row = await db.query.category.findFirst({
      where: eq(category.slug, slug),
    });
    if (!row)
      throw new Error(
        `Unknown category slug "${slug}". Seed taxonomy before loading the catalogue.`,
      );
    categoryCache.set(slug, row.id);
    return row.id;
  }

  async function resolveProvenance(key: string): Promise<number> {
    if (provenanceCache.has(key)) return provenanceCache.get(key)!;
    const row = await db.query.provenanceType.findFirst({
      where: eq(provenanceType.key, key),
    });
    if (!row) throw new Error(`Unknown provenance_type key "${key}".`);
    provenanceCache.set(key, row.id);
    return row.id;
  }

  async function resolveIdentifierKind(key: string): Promise<number> {
    if (identifierKindCache.has(key)) return identifierKindCache.get(key)!;
    const row = await db.query.identifierKind.findFirst({
      where: eq(identifierKind.key, key),
    });
    if (!row) throw new Error(`Unknown identifier_kind key "${key}".`);
    identifierKindCache.set(key, row.id);
    return row.id;
  }

  // A source is a citation: same kind, same URL, same retrieval date, same
  // title, publisher and note is the same citation, not a second one. Reused
  // rather than re-inserted, because the loader now walks rows it already
  // holds on every pass and a fresh source row per pass would grow the table
  // without bound while telling nobody anything new.
  async function resolveSource(s: Source): Promise<number> {
    const key = JSON.stringify([
      s.kind,
      s.url,
      s.title ?? null,
      s.publisher ?? null,
      s.retrieved_on,
      s.note ?? null,
    ]);
    const cached = sourceCache.get(key);
    if (cached !== undefined) {
      result.sourcesReused++;
      return cached;
    }

    const [existing] = await db
      .select({ id: source.id })
      .from(source)
      .where(
        and(
          eq(source.kind, s.kind),
          eq(source.url, s.url),
          s.title === undefined ? isNull(source.title) : eq(source.title, s.title),
          s.publisher === undefined
            ? isNull(source.publisher)
            : eq(source.publisher, s.publisher),
          eq(source.retrievedOn, s.retrieved_on),
          s.note === undefined ? isNull(source.note) : eq(source.note, s.note),
        ),
      )
      .limit(1);
    if (existing) {
      sourceCache.set(key, existing.id);
      result.sourcesReused++;
      return existing.id;
    }

    const [row] = await db
      .insert(source)
      .values({
        kind: s.kind,
        url: s.url,
        title: s.title ?? null,
        publisher: s.publisher ?? null,
        retrievedOn: s.retrieved_on,
        note: s.note ?? null,
      })
      .returning({ id: source.id });
    if (!row) throw new Error("source insert returned no row");
    sourceCache.set(key, row.id);
    result.sourcesInserted++;
    return row.id;
  }

  // verification carries a UNIQUE index on (target_table, target_id), so a row
  // holds exactly one verification and two documents describing the same
  // object cannot both keep a link. Before this, the first one to land won and
  // the second was dropped on the floor: that is how one Dark Horse statue
  // kept a publisher page and lost the operator's in-hand photograph, the
  // strongest tier in the rubric. Now the STRONGEST wins, whichever pass it
  // arrives on, and its source is inserted with it. A weaker or equal
  // verification changes nothing, which is what keeps a re-seed silent.
  //
  // Note what this cannot do without a schema change: accumulate SEVERAL
  // verifications and several sources onto one row. That needs the unique
  // index dropped, and catalogue_item and variant have no source link of
  // their own at all -- their only link to a source is through this row. See
  // the report accompanying this change.
  async function applyVerification(
    targetTable: string,
    targetId: number,
    v: Verification,
    s: Source,
  ): Promise<void> {
    const [existing] = await db
      .select({ id: verification.id, method: verification.method })
      .from(verification)
      .where(
        and(
          eq(verification.targetTable, targetTable),
          eq(verification.targetId, targetId),
        ),
      )
      .limit(1);

    if (!existing) {
      const sourceId = await resolveSource(s);
      await db.insert(verification).values({
        targetTable,
        targetId,
        method: v.method,
        sourceId,
        verifiedOn: v.verified_on,
        verifiedBy: v.verified_by,
        note: v.note ?? null,
      });
      result.verificationsInserted++;
      return;
    }

    if (strengthOf(v.method) <= strengthOf(existing.method)) {
      result.verificationsSkippedWeaker++;
      return;
    }

    const sourceId = await resolveSource(s);
    await db
      .update(verification)
      .set({
        method: v.method,
        sourceId,
        verifiedOn: v.verified_on,
        verifiedBy: v.verified_by,
        note: v.note ?? null,
      })
      .where(eq(verification.id, existing.id));
    result.verificationsStrengthened++;
  }

  // Identifier identity within a variant is kind plus normalized value, and
  // normalized is the database's own generated column, mirrored here by
  // normalizeIdentifier (proven byte-identical by tests/normalize-parity).
  // Deliberately scoped to the variant: the same barcode on two variants is a
  // legitimate state, the one that produces the UNCERTAIN verdict, so an
  // identifier is never used to decide which variant it belongs to.
  async function mergeIdentifiers(
    variantId: number,
    identifiers: SeedIdentifier[],
    known: Map<string, number>,
  ): Promise<void> {
    for (const idf of identifiers) {
      const identifierKindId = await resolveIdentifierKind(idf.kind);
      const key = `${identifierKindId}:${normalizeIdentifier(idf.value)}`;

      const existingId = known.get(key);
      if (existingId !== undefined) {
        result.identifiersSkippedExisting++;
        await applyVerification(
          "variant_identifier",
          existingId,
          idf.verification,
          idf.source,
        );
        continue;
      }

      const idfSourceId = await resolveSource(idf.source);
      const [idfRow] = await db
        .insert(variantIdentifier)
        .values({
          variantId,
          identifierKindId,
          value: idf.value,
          sourceId: idfSourceId,
        })
        .returning({ id: variantIdentifier.id });
      if (!idfRow) throw new Error("variant_identifier insert returned no row");
      result.identifiersInserted++;
      known.set(key, idfRow.id);

      await applyVerification(
        "variant_identifier",
        idfRow.id,
        idf.verification,
        idf.source,
      );
    }
  }

  async function knownIdentifiers(variantId: number): Promise<Map<string, number>> {
    const rows = await db
      .select({
        id: variantIdentifier.id,
        identifierKindId: variantIdentifier.identifierKindId,
        normalized: variantIdentifier.normalized,
      })
      .from(variantIdentifier)
      .where(eq(variantIdentifier.variantId, variantId));
    return new Map(
      rows.map((r) => [`${r.identifierKindId}:${r.normalized ?? ""}`, r.id]),
    );
  }

  // Variant identity within an item is its NAME, and nothing else.
  //
  // Not name plus provenance_type: the database's unique index is
  // (catalogue_item_id, name), so a "Standard Edition" arriving as retail on
  // one pass and as promotional on another is one row by the schema's own
  // rule, and treating them as two would try an insert the index rejects.
  // Not identifiers either, in any combination: two variants legitimately
  // share a barcode -- that is the UNCERTAIN case working -- so an identifier
  // cannot decide which variant it describes.
  async function mergeVariants(
    itemId: number,
    variants: SeedVariant[],
    known: Map<string, number>,
  ): Promise<void> {
    for (const v of variants) {
      const key = variantIdentityKey(v.name);
      const existingId = known.get(key);

      if (existingId !== undefined) {
        result.variantsSkippedExisting++;
        await applyVerification("variant", existingId, v.verification, v.source);
        await mergeIdentifiers(
          existingId,
          v.identifiers,
          await knownIdentifiers(existingId),
        );
        continue;
      }

      const provenanceTypeId = await resolveProvenance(v.provenance_type);
      const { publicId: variantPublicId, variantRow } =
        await insertWithFreshPublicId(async (candidateId) => {
          const [row] = await db
            .insert(variant)
            .values({
              publicId: candidateId,
              catalogueItemId: itemId,
              name: v.name,
              provenanceTypeId,
              regionNote: v.region_note ?? null,
              releaseDate: v.release_date ?? null,
              printRun: v.print_run ?? null,
              editionNumber: v.edition_number ?? null,
              createdBy: originLabel,
            })
            .returning({ id: variant.id });
          if (!row) throw new Error("variant insert returned no row");
          return { publicId: candidateId, variantRow: row };
        });
      result.variantsInserted++;
      known.set(key, variantRow.id);

      await applyVerification("variant", variantRow.id, v.verification, v.source);

      await db.insert(permalink).values({
        publicId: variantPublicId,
        targetTable: "variant",
        targetId: variantRow.id,
        isCanonical: true,
      });

      await mergeIdentifiers(variantRow.id, v.identifiers, new Map());
    }
  }

  async function knownVariants(itemId: number): Promise<Map<string, number>> {
    const rows = await db
      .select({ id: variant.id, name: variant.name })
      .from(variant)
      .where(eq(variant.catalogueItemId, itemId));
    return new Map(rows.map((r) => [variantIdentityKey(r.name), r.id]));
  }

  for (const item of doc.items) {
    const franchiseId = await resolveFranchise(item.franchise);
    const categoryId = await resolveCategory(item.category);
    // Identity first, slug second. These are different questions and
    // conflating them broke both directions in turn.
    //
    // Identity: an item is the same item if the franchise, category, title,
    // subtitle and release year all match. That is what makes a re-seed
    // idempotent. Deciding identity by "is the slug taken" instead means a
    // second run finds its own slug occupied, escalates to a variant of it,
    // and inserts a duplicate of the row it should have recognised.
    //
    // Slug: two DIFFERENT items can legitimately share a title. This franchise
    // has a 1996 "Tomb Raider" and a 2013 "Tomb Raider", and remasters and
    // regional editions will produce more. So escalate title, then title plus
    // subtitle, then title plus year, and finally a numeric suffix. The slug is
    // decorative because resolution goes through public_id, so a suffix costs
    // nothing.
    const sameTitle = await db
      .select()
      .from(catalogueItem)
      .where(and(eq(catalogueItem.franchiseId, franchiseId), eq(catalogueItem.title, item.title)));

    // A missing release year is unknown, not distinguishing. An in-hand
    // photograph of a box frequently shows no year, and treating null as a
    // distinct value split one Dark Horse statue into two catalogue items:
    // one from a publisher page carrying 2025, one from the operator's own
    // photograph carrying nothing. Same object, two rows, and the in-hand
    // verification stranded on the duplicate instead of strengthening the
    // original.
    //
    // So: same title and subtitle, and years that do not actively contradict
    // each other, is the same item. Two years that are both present and
    // different are genuinely different releases.
    //
    // Category, by contrast, is compared STRICTLY, and it can be, because it
    // is the one discriminator here that is never absent: catalogue_item
    // .category_id is NOT NULL and seedItemSchema requires the slug. Nothing
    // is being read out of a missing value, so the rule that broke this seam
    // twice does not apply. A game and the strategy guide covering it are
    // conventionally titled alike and share a release year -- "Tomb Raider:
    // Legend" 2006 in games against the Piggyback guide of the same name and
    // year in guides-and-books. Without category they fold to one identity,
    // the guide's variants and identifiers land on the game, and the loader
    // reports a SKIP rather than an error. Silent loss into a neighbouring
    // row is the worst failure available here, so category counts.
    //
    // Publisher is deliberately NOT part of identity, even though it also
    // separates that pair. It is optional in the schema and absent on rows
    // here, so it could only ever be compared the way release year is --
    // absence does not distinguish -- and that leaves it doing nothing except
    // splitting rows where two sources spell one publisher differently.
    // Measured against the five research documents: identity with publisher
    // yields 98 items instead of 96, and the two extra rows are exactly the
    // defects already fixed once. It re-splits the Dark Horse statue
    // ("Dark Horse Deluxe" against "Dark Horse Comics") and it re-splits the
    // Record Store Day pressing ("Real Gone Music", the reissue label,
    // against "Elektra", the original). Same object, different label on the
    // sleeve. Category is a taxonomy slug from a closed list; publisher is
    // free text off a product, and free text is not a key.
    const identical = sameTitle.find((row) => {
      if (row.categoryId !== categoryId) return false;
      if ((row.subtitle ?? null) !== (item.subtitle ?? null)) return false;
      const a = row.releaseYear ?? null;
      const b = item.release_year ?? null;
      return a === null || b === null || a === b;
    });
    if (identical) {
      // Matched, not skipped. The item row stays exactly as it is; what the
      // document brings that the row does not yet have -- variants,
      // identifiers, a stronger verification -- is added to it.
      result.itemsSkippedExisting++;
      await applyVerification(
        "catalogue_item",
        identical.id,
        item.verification,
        item.source,
      );
      await mergeVariants(
        identical.id,
        item.variants,
        await knownVariants(identical.id),
      );
      continue;
    }

    const taken = new Set(sameTitle.map((row) => row.slug));
    const allSlugs = await db.select({ slug: catalogueItem.slug }).from(catalogueItem)
      .where(eq(catalogueItem.franchiseId, franchiseId));
    for (const row of allSlugs) taken.add(row.slug);

    // Left exactly as it was when category joined identity above. A game and
    // the guide covering it now correctly become two rows, and the second one
    // lands on "<title>-<year>" -- a slug naming the fact the two rows AGREE
    // on rather than the one they differ on. That is cosmetic and it stays
    // cosmetic: nothing resolves by slug, /i/{public_id}/{slug} resolves by
    // public_id, and the unique index on (franchise_id, slug) means a mistake
    // here crashes rather than merges. Reordering these to put category first
    // would hand "<title>-<category>" to the 1996 and 2013 "Tomb Raider"
    // games, which share a category and differ by year. The escalation cannot
    // be right for both without asking WHICH stored row took the base slug,
    // and that is more machinery than a decorative field earns.
    const bases = [
      slugify(item.title),
      item.subtitle ? slugify(`${item.title} ${item.subtitle}`) : null,
      item.release_year ? slugify(`${item.title} ${item.release_year}`) : null,
    ].filter((c): c is string => c !== null);

    let slug = bases.find((c) => !taken.has(c)) ?? null;
    if (slug === null) {
      // Every readable form is taken by a different item. Suffix rather than
      // skip: this row is genuinely new, it just needs a distinct URL.
      const base = bases[bases.length - 1] ?? slugify(item.title);
      for (let n = 2; n < 100 && slug === null; n++) {
        const candidate = `${base}-${n}`;
        if (!taken.has(candidate)) slug = candidate;
      }
    }
    if (slug === null) {
      result.itemsSkippedExisting++;
      continue;
    }

    const { publicId, itemRow } = await insertWithFreshPublicId(
      async (candidateId) => {
        const [row] = await db
          .insert(catalogueItem)
          .values({
            publicId: candidateId,
            slug,
            franchiseId,
            categoryId,
            title: item.title,
            subtitle: item.subtitle ?? null,
            releaseYear: item.release_year ?? null,
            copyrightYear: item.copyright_year ?? null,
            publisher: item.publisher ?? null,
            developer: item.developer ?? null,
            descriptionMd: item.description_md ?? null,
            createdBy: originLabel,
          })
          .returning({ id: catalogueItem.id });
        if (!row) throw new Error("catalogue_item insert returned no row");
        return { publicId: candidateId, itemRow: row };
      },
    );
    result.itemsInserted++;

    await applyVerification(
      "catalogue_item",
      itemRow.id,
      item.verification,
      item.source,
    );

    await db.insert(permalink).values({
      publicId,
      targetTable: "catalogue_item",
      targetId: itemRow.id,
      isCanonical: true,
    });

    await mergeVariants(itemRow.id, item.variants, new Map());
  }

  return result;
}
