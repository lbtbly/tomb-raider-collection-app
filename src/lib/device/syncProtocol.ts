// The sync protocol's shape and its pure convergence logic, shared by the
// server (src/app/api/sync/index/route.ts) and the client
// (src/lib/device/sync.ts). Kept free of `idb` and of any browser or
// Node-only global, exactly like src/lib/verdict/engine.ts, so it is
// directly unit-testable and so a drift between what the server sends and
// what the client applies is a type error, not a bug found in production.
//
// Fixes the defect measured 2026-08-18: the delta feed had no deletion
// mechanism. A device that had synced kept every row it had ever seen,
// forever, with no way to learn that a variant's identity changed
// (merged, withdrawn) or that the catalogue had been rebuilt wholesale.
// Two mechanisms, because the two failure modes are different shapes:
//
// - Tombstones. Every delta row now carries `isLive`. A row transitions to
//   `isLive: false` when its variant or catalogue_item status leaves
//   "published" (merge, withdrawal) -- PLAN.md's schema already carries
//   that status column, so the server change is a WHERE clause, not a new
//   table. The client removes a tombstoned row instead of upserting it.
// - Epoch. A single server-stamped value (`sync_epoch`, migration
//   0002) that changes only when the database is rebuilt from empty,
//   which is exactly what a full local reseed does and exactly what broke
//   the device index. A client whose stored epoch does not match the
//   server's gets `fullResync: true` and a complete, authoritative row
//   set; applyDelta then replaces its entire local set rather than
//   patching it, so a variant whose public_id changed under a reseed is
//   dropped even though no single delta row ever named it as removed.

import type { CatalogueIndexRow } from "./schema";

/** The shape the on-device catalogueIndex store actually keeps. Re-exported
 * from here so this file stays the one place the wire shape and the stored
 * shape are related, rather than two hand-maintained copies drifting apart. */
export type StoredIndexRow = CatalogueIndexRow;

export type SyncIndexRow = StoredIndexRow & {
  /** false once the variant or its catalogue item is no longer "published"
   * (merged or withdrawn): a tombstone, not a row to keep. */
  isLive: boolean;
};

export type SyncIndexResponse = {
  /** The server's current epoch (sync_epoch.epoch). */
  epoch: string;
  /** Pass back on the next request; rows are those changed since this
   * moment, or since 1970-01-01 in the special case of a full resync. */
  cursor: string;
  /** True when the caller's epoch was missing or stale: `rows` is then the
   * complete, authoritative set of published variants (never a partial
   * delta, and never carrying a tombstone, since there is nothing to
   * remove a device's existing state against -- the device's existing
   * state is discarded outright). */
  fullResync: boolean;
  rows: SyncIndexRow[];
};

// isLive is dropped on purpose: a stored row is by definition one of the
// live ones.
function toStoredRow(row: SyncIndexRow): StoredIndexRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLive, ...rest } = row;
  return rest;
}

export type ApplyResult = {
  rows: StoredIndexRow[];
  /** variantPublicIds removed from the device's set by this apply, either
   * because a delta row tombstoned them or because a full resync's
   * authoritative set no longer contains them. Exposed so a caller (and a
   * test) can prove convergence rather than assert it. */
  removedIds: string[];
  /** variantPublicIds written (inserted or replaced) by this apply. */
  upsertedIds: string[];
};

// Pure: takes whatever the device already holds and the server's response,
// and returns the new complete set. No IndexedDB read or write happens
// here; src/lib/device/sync.ts owns translating this into store operations,
// exactly the split src/lib/verdict/engine.ts already draws between
// deciding and doing.
export function applyDelta(current: StoredIndexRow[], response: SyncIndexResponse): ApplyResult {
  if (response.fullResync) {
    const rows = response.rows.map(toStoredRow);
    const nextIds = new Set(rows.map((r) => r.variantPublicId));
    const removedIds = current
      .map((r) => r.variantPublicId)
      .filter((id) => !nextIds.has(id));
    return { rows, removedIds, upsertedIds: [...nextIds] };
  }

  const byId = new Map(current.map((r) => [r.variantPublicId, r]));
  const removedIds: string[] = [];
  const upsertedIds: string[] = [];
  for (const row of response.rows) {
    if (row.isLive) {
      byId.set(row.variantPublicId, toStoredRow(row));
      upsertedIds.push(row.variantPublicId);
    } else if (byId.delete(row.variantPublicId)) {
      removedIds.push(row.variantPublicId);
    }
    // A tombstone for a row the device never held is a no-op, not an error:
    // it simply means this device synced after the removal already happened.
  }
  return { rows: [...byId.values()], removedIds, upsertedIds };
}
