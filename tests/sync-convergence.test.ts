// Proves the fix to the sync protocol defect measured 2026-08-18: a device
// that has synced, then had rows change identity on the server, converges
// to the server's truth with no human clearing storage. Two tests, one per
// failure mode (see src/lib/device/syncProtocol.ts):
//
// - A row changes status (merge, withdrawal) without the database being
//   rebuilt: the delta feed must tombstone it rather than silently drop it
//   from a WHERE clause forever.
// - The whole catalogue is rebuilt wholesale, minting new public_ids for
//   the same real-world variants (docker compose down -v; migrate; seed):
//   no delta row can name an id that no longer exists anywhere, so this is
//   caught by the sync_epoch mismatch instead, and answered with a
//   complete, authoritative row set rather than a patch.
//
// Both tests call the real route handler (src/app/api/sync/index/route.ts)
// against the local Docker Postgres, then apply the response through the
// real, pure client logic (src/lib/device/syncProtocol.ts#applyDelta) --
// the same function src/lib/device/sync.ts calls -- so this exercises the
// server and the client sides of the same contract, not a re-description of
// either. Skips with a clear message if the local database is not reachable,
// same as tests/normalize-parity.test.ts, rather than failing red.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { insertWithFreshPublicId } from "../src/lib/id/public-id";
import { applyDelta, type SyncIndexResponse } from "../src/lib/device/syncProtocol";
import type { StoredIndexRow } from "../src/lib/device/syncProtocol";
import { GET } from "../src/app/api/sync/index/route";

const FRANCHISE_SLUG = "sync-convergence-test-franchise";
const CATEGORY_SLUG = "sync-convergence-test-category";

// src/db/index.ts holds one pooled connection for the life of the process
// (deliberately, for the running app); this test file is the first thing
// under tests/ to import it rather than opening its own throwaway client, so
// it is also the first to need to close it. Every scripts/checks/*.ts script
// in this repository ends the same way for the same reason (grep
// "process.exit" there). process.exitCode, not a hardcoded 0, so a real
// assertion failure above still fails the run instead of being swallowed.
after(async () => {
  // A short delay before exiting: the test runner's own reporter still has
  // pending writes queued when this hook fires, and process.exit() is
  // synchronous and would cut them off mid-flush.
  await new Promise((r) => setTimeout(r, 200));
  process.exit(process.exitCode ?? 0);
});

async function dbReachable(): Promise<boolean> {
  try {
    await db.execute(drizzleSql`select 1`);
    return true;
  } catch {
    return false;
  }
}

async function currentEpoch(): Promise<string> {
  const rows = await db.execute<{ epoch: string }>(drizzleSql`select epoch from sync_epoch where id = 1`);
  const epoch = rows[0]?.epoch;
  assert.ok(epoch, "sync_epoch has no row; run `npm run db:migrate`");
  return epoch;
}

async function fetchDelta(cursor: string | null, epoch: string | null): Promise<SyncIndexResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (epoch) params.set("epoch", epoch);
  const qs = params.toString();
  const res = await GET(
    new Request(`http://localhost/api/sync/index${qs ? `?${qs}` : ""}`),
  );
  if (res.status !== 200) {
    assert.fail(`route returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as SyncIndexResponse;
}

// Isolated from the real seeded catalogue: its own franchise, cleaned up in
// `finally` so this test is safe to run against a database already holding
// the real 220-item catalogue, and safe to run twice in a row.
async function setUpFranchise(): Promise<number> {
  await db.insert(schema.category).values({
    slug: CATEGORY_SLUG,
    name: "Sync convergence test category",
    parentId: null,
    sort: 999,
  }).onConflictDoNothing({ target: schema.category.slug });

  const { itemRow: franchiseRow } = await insertWithFreshPublicId(async (publicId) => {
    const [row] = await db
      .insert(schema.franchise)
      .values({
        publicId,
        slug: FRANCHISE_SLUG,
        name: "Sync convergence test franchise",
        summary: "Synthetic data for tests/sync-convergence.test.ts. Never a real franchise.",
      })
      .onConflictDoNothing({ target: schema.franchise.slug })
      .returning({ id: schema.franchise.id });
    if (row) return { itemRow: row };
    const [existing] = await db
      .select({ id: schema.franchise.id })
      .from(schema.franchise)
      .where(eq(schema.franchise.slug, FRANCHISE_SLUG));
    if (!existing) throw new Error("franchise upsert produced no row");
    return { itemRow: existing };
  });
  return franchiseRow.id;
}

async function tearDown(franchiseId: number): Promise<void> {
  const items = await db
    .select({ id: schema.catalogueItem.id })
    .from(schema.catalogueItem)
    .where(eq(schema.catalogueItem.franchiseId, franchiseId));
  for (const item of items) {
    const variants = await db
      .select({ id: schema.variant.id })
      .from(schema.variant)
      .where(eq(schema.variant.catalogueItemId, item.id));
    for (const v of variants) {
      await db.delete(schema.variantIdentifier).where(eq(schema.variantIdentifier.variantId, v.id));
      await db.delete(schema.verification).where(
        and(eq(schema.verification.targetTable, "variant"), eq(schema.verification.targetId, v.id)),
      );
    }
    await db.delete(schema.variant).where(eq(schema.variant.catalogueItemId, item.id));
    await db.delete(schema.verification).where(
      and(eq(schema.verification.targetTable, "catalogue_item"), eq(schema.verification.targetId, item.id)),
    );
  }
  await db.delete(schema.catalogueItem).where(eq(schema.catalogueItem.franchiseId, franchiseId));
  await db.delete(schema.franchise).where(eq(schema.franchise.id, franchiseId));
  // The category too. It was missed, and the row outlived every run: a
  // `select slug from category` found `sync-convergence-test-category` sitting
  // in the taxonomy with 0 items. `check:no-fixture` could not see it either,
  // because it matches slugs prefixed `fixture-` and this one is not, so a
  // test artifact was surviving the one guard built to stop test artifacts.
  await db.delete(schema.category).where(eq(schema.category.slug, CATEGORY_SLUG));
}

test("a variant that leaves 'published' (merge/withdrawal) tombstones on the device instead of surviving forever", async () => {
  if (!(await dbReachable())) {
    console.log("Skipping sync-convergence: local Postgres not reachable. Run `docker compose up -d` first.");
    return;
  }

  const franchiseId = await setUpFranchise();
  try {
    const t0 = new Date();
    // A short pause guarantees the row's created_at/updated_at land strictly
    // after t0 even at low clock resolution, so the delta query's
    // "> cursor" is unambiguous.
    await new Promise((r) => setTimeout(r, 20));

    const [item] = await db
      .insert(schema.catalogueItem)
      .values({
        publicId: "TCONVRG001",
        slug: "sync-convergence-item",
        franchiseId,
        categoryId: (
          await db.query.category.findFirst({ where: eq(schema.category.slug, CATEGORY_SLUG) })
        )!.id,
        title: "Sync Convergence Test Item",
        createdBy: "test:sync-convergence",
      })
      .returning({ id: schema.catalogueItem.id });
    assert.ok(item);

    const provenance = await db.query.provenanceType.findFirst({ where: eq(schema.provenanceType.key, "retail") });
    assert.ok(provenance, "provenance_type 'retail' must be seeded (npm run db:seed)");

    const [variant] = await db
      .insert(schema.variant)
      .values({
        publicId: "TCONVRG00A",
        catalogueItemId: item!.id,
        name: "Test variant A",
        provenanceTypeId: provenance!.id,
        createdBy: "test:sync-convergence",
      })
      .returning({ id: schema.variant.id });
    assert.ok(variant);

    const epoch = await currentEpoch();

    // Step 1: this device's first sync ever sees the variant, published.
    const first = await fetchDelta(t0.toISOString(), epoch);
    const firstRow = first.rows.find((r) => r.variantPublicId === "TCONVRG00A");
    assert.ok(firstRow, "the new variant must appear in the delta since t0");
    assert.equal(firstRow!.isLive, true);

    let deviceIndex: StoredIndexRow[] = [];
    const applied1 = applyDelta(deviceIndex, first);
    deviceIndex = applied1.rows;
    assert.ok(deviceIndex.some((r) => r.variantPublicId === "TCONVRG00A"), "device holds the variant after sync 1");

    // Step 2: the variant's identity changes on the server -- withdrawn,
    // standing in for a merge (both leave "published", which is the
    // condition the delta feed and applyDelta actually key off).
    await db
      .update(schema.variant)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(eq(schema.variant.id, variant!.id));

    // Step 3: this device syncs again from its own last cursor. No storage
    // was cleared by a human; convergence has to come from the protocol.
    const second = await fetchDelta(first.cursor, first.epoch);
    const secondRow = second.rows.find((r) => r.variantPublicId === "TCONVRG00A");
    assert.ok(secondRow, "the withdrawn variant must still be emitted, as a tombstone");
    assert.equal(secondRow!.isLive, false);
    assert.equal(second.fullResync, false, "an ordinary status change is a delta, not a full resync");

    const applied2 = applyDelta(deviceIndex, second);
    deviceIndex = applied2.rows;

    assert.deepEqual(applied2.removedIds, ["TCONVRG00A"]);
    assert.ok(
      !deviceIndex.some((r) => r.variantPublicId === "TCONVRG00A"),
      "the device must no longer hold the withdrawn variant: converged to server truth with no storage clear",
    );
  } finally {
    await tearDown(franchiseId);
  }
});

test("an epoch mismatch (catalogue rebuilt wholesale) forces a full resync that drops orphaned rows", async () => {
  if (!(await dbReachable())) {
    console.log("Skipping sync-convergence: local Postgres not reachable. Run `docker compose up -d` first.");
    return;
  }

  const realEpoch = await currentEpoch();
  const staleEpoch = "00000000-0000-0000-0000-000000000000";
  assert.notEqual(staleEpoch, realEpoch);

  // Stand-in for "the device's whole index from before a wholesale reseed":
  // an id that certainly does not exist in the live database right now,
  // exactly the shape a truncated-and-reseeded public_id takes -- there is
  // no row left anywhere to tombstone it with, which is why this case
  // cannot be solved by the delta mechanism above and needs the epoch check.
  const orphanId = "ORPHANEDID";
  const staleDeviceIndex: StoredIndexRow[] = [
    {
      variantPublicId: orphanId,
      itemPublicId: "ORPHANITEM",
      title: "A variant from before the reseed",
      year: null,
      category: "games",
      variantName: "Pre-reseed printing",
      provenanceType: "retail",
      identifiers: [],
      normalizedIdentifiers: [],
      updatedAt: new Date(0).toISOString(),
    },
  ];

  // A cursor from "the last successful sync", deliberately recent, to prove
  // the epoch mismatch overrides the cursor rather than being combined with
  // it: a stale epoch must not let a recent cursor suppress the full set.
  const recentCursor = new Date().toISOString();
  const response = await fetchDelta(recentCursor, staleEpoch);

  assert.equal(response.fullResync, true, "a stale epoch must force a full resync regardless of cursor");
  assert.equal(response.epoch, realEpoch, "the response reports the server's current epoch");
  assert.ok(response.rows.every((r) => r.isLive), "a full resync's rows are all live; nothing to tombstone");

  const { rows, removedIds } = applyDelta(staleDeviceIndex, response);

  assert.ok(removedIds.includes(orphanId), "the orphaned pre-reseed row must be dropped");
  assert.ok(
    !rows.some((r) => r.variantPublicId === orphanId),
    "the device's post-sync set must not carry a row absent from the live database",
  );

  // Cross-check against SQL directly: the full-resync row count matches the
  // live count of published variants under published items, independent of
  // the route's own query.
  const countRows = await db.execute<{ count: string }>(drizzleSql`
    select count(*)::text as count
    from variant v
    join catalogue_item ci on ci.id = v.catalogue_item_id
    where v.status = 'published' and ci.status = 'published'
  `);
  assert.ok(countRows[0]);
  assert.equal(rows.length, Number(countRows[0].count));
});
