// The catalogue index endpoint, with a delta cursor AND a deletion
// mechanism (PLAN.md, slice 1 server scope; fixed 2026-08-18, see
// src/lib/device/syncProtocol.ts for why). Read-only: it selects from the
// tables the data-layer agent built (src/db/schema.ts) and never writes to
// them, except that it reads the one-row sync_epoch table migration 0002
// created.
//
// GET /api/sync/index                        -> full resync, this device's
//                                                epoch is missing or unknown
// GET /api/sync/index?cursor=ISO&epoch=E      -> a delta since that cursor,
//                                                IF epoch E still matches
//                                                the server's; otherwise a
//                                                full resync regardless of
//                                                the cursor supplied
//
// Two failure modes, two mechanisms (both in the response's `rows`, via
// `isLive` and `fullResync`; see syncProtocol.ts):
//
// - A variant or its catalogue item leaves "published" (merge, withdrawal).
//   That row still matches "changed since cursor" on its updated_at, so it
//   is still emitted in a delta -- just with isLive: false, a tombstone,
//   rather than being silently dropped from the WHERE clause the way the
//   previous version of this endpoint dropped it forever.
// - The whole catalogue is rebuilt wholesale (a full local reseed mints new
//   public_ids for the same real-world variants). No delta row can name an
//   id that no longer exists anywhere in the database, so this is not a
//   tombstone problem; it is caught instead by comparing epochs and, on a
//   mismatch, replacing the device's entire set rather than patching it.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { SyncIndexResponse, SyncIndexRow } from "@/lib/device/syncProtocol";

export const dynamic = "force-dynamic";

type Row = {
  variant_public_id: string;
  item_public_id: string;
  title: string;
  year: number | null;
  category: string;
  variant_name: string;
  provenance_type: string;
  updated_at: string;
  is_live: boolean;
  identifiers: { kind: string; normalized: string }[];
};

const EPOCH_ZERO = new Date(0);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cursorParam = url.searchParams.get("cursor");
  const epochParam = url.searchParams.get("epoch");

  if (cursorParam !== null) {
    const parsed = new Date(cursorParam);
    if (Number.isNaN(parsed.getTime())) {
      return Response.json({ error: "cursor must be an ISO 8601 timestamp" }, { status: 400 });
    }
  }

  const epochRows = await db.execute<{ epoch: string }>(
    sql`select epoch from sync_epoch where id = 1`,
  );
  const currentEpoch = epochRows[0]?.epoch;
  if (!currentEpoch) {
    // Migration 0002 always inserts this row; a missing one means the
    // database has not been migrated, not that there is nothing to report.
    return Response.json(
      { error: "sync_epoch is not seeded; run the pending database migrations" },
      { status: 500 },
    );
  }

  const epochMatches = epochParam !== null && epochParam === currentEpoch;
  const fullResync = !epochMatches;
  // A stale or missing epoch discards whatever cursor the caller sent: its
  // whole local set is about to be replaced, not patched, so "changed since
  // my old cursor" is not the right question anymore.
  const cursor = fullResync ? EPOCH_ZERO : cursorParam ? new Date(cursorParam) : EPOCH_ZERO;

  const nextCursor = new Date().toISOString();

  const result = await db.execute<Row>(sql`
    select
      v.public_id as variant_public_id,
      ci.public_id as item_public_id,
      ci.title as title,
      ci.release_year as year,
      c.slug as category,
      v.name as variant_name,
      pt.key as provenance_type,
      greatest(v.updated_at, ci.updated_at) as updated_at,
      (v.status = 'published' and ci.status = 'published') as is_live,
      coalesce(
        json_agg(
          json_build_object('kind', ik.key, 'normalized', vi.normalized)
        ) filter (where vi.id is not null),
        '[]'
      ) as identifiers
    from variant v
    join catalogue_item ci on ci.id = v.catalogue_item_id
    join category c on c.id = ci.category_id
    join provenance_type pt on pt.id = v.provenance_type_id
    left join variant_identifier vi on vi.variant_id = v.id
    left join identifier_kind ik on ik.id = vi.identifier_kind_id
    where greatest(v.updated_at, ci.updated_at) > ${cursor.toISOString()}::timestamptz
      ${fullResync ? sql`and v.status = 'published' and ci.status = 'published'` : sql``}
    group by v.id, ci.id, c.slug, pt.key
    order by greatest(v.updated_at, ci.updated_at) asc
  `);

  const rows: SyncIndexRow[] = result.map((r) => ({
    variantPublicId: r.variant_public_id,
    itemPublicId: r.item_public_id,
    title: r.title,
    year: r.year,
    category: r.category,
    variantName: r.variant_name,
    provenanceType: r.provenance_type,
    identifiers: r.identifiers,
    normalizedIdentifiers: r.identifiers.map((i) => i.normalized),
    updatedAt: r.updated_at,
    isLive: r.is_live,
  }));

  const body: SyncIndexResponse = { epoch: currentEpoch, cursor: nextCursor, fullResync, rows };
  return Response.json(body);
}
