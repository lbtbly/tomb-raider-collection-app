// Pulls the catalogue index delta from /api/sync/index and merges it into
// the on-device catalogueIndex store. The check screen never calls this
// itself and never waits on it: PLAN.md is explicit that a network call may
// refine a verdict, it may never gate one. This runs on load, in the
// background, best-effort.
//
// Fixed 2026-08-18: this used to `put` every row the server sent and never
// removed anything, so a device could only ever accumulate rows. See
// src/lib/device/syncProtocol.ts for the tombstone-plus-epoch protocol this
// now speaks, and src/app/api/sync/index/route.ts for the server half.

import { getDb } from "./db";
import { applyDelta, type SyncIndexResponse } from "./syncProtocol";

export type SyncResult = {
  fetched: number;
  removed: number;
  cursor: string;
  fullResync: boolean;
};

export async function syncCatalogueIndex(): Promise<SyncResult> {
  const db = await getDb();
  const meta = await db.get("meta", "sync");
  const cursor = meta && meta.key === "sync" ? meta.cursor : null;
  const epoch = meta && meta.key === "sync" ? meta.epoch : null;

  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (epoch) params.set("epoch", epoch);
  const qs = params.toString();
  const url = qs ? `/api/sync/index?${qs}` : "/api/sync/index";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  const data = (await res.json()) as SyncIndexResponse;

  const current = await db.getAll("catalogueIndex");
  const { rows, removedIds, upsertedIds } = applyDelta(current, data);

  const tx = db.transaction(["catalogueIndex", "meta"], "readwrite");
  const store = tx.objectStore("catalogueIndex");
  if (data.fullResync) {
    // The device's whole set is being replaced, not patched: clearing first
    // is what makes a variant whose public_id changed under a reseed
    // actually disappear, rather than surviving alongside its replacement
    // under a different id forever.
    await store.clear();
  }
  for (const row of rows) {
    await store.put(row);
  }
  const nowIso = new Date().toISOString();
  await tx.objectStore("meta").put({ key: "sync", cursor: data.cursor, lastSyncedAt: nowIso, epoch: data.epoch });
  await tx.done;

  return {
    fetched: upsertedIds.length,
    removed: removedIds.length,
    cursor: data.cursor,
    fullResync: data.fullResync,
  };
}

export async function getSyncMeta(): Promise<{
  cursor: string | null;
  lastSyncedAt: string | null;
  epoch: string | null;
}> {
  const db = await getDb();
  const meta = await db.get("meta", "sync");
  if (!meta || meta.key !== "sync") return { cursor: null, lastSyncedAt: null, epoch: null };
  return { cursor: meta.cursor, lastSyncedAt: meta.lastSyncedAt, epoch: meta.epoch };
}

export async function getCatalogueIndexSize(): Promise<number> {
  const db = await getDb();
  return db.count("catalogueIndex");
}

export async function listCatalogueIndex() {
  const db = await getDb();
  return db.getAll("catalogueIndex");
}
