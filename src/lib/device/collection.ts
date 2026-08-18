// The user's own, on-device collection. Anonymous adds write only here
// (DESIGN.md note 2); nothing leaves the device until an account claims it
// in a later slice. Every add also queues an outbox entry carrying a
// client-generated operation id, so a write made offline and later replayed
// on reconnect creates exactly one server-side row (F15) rather than a
// duplicate, even if the replay is retried.

import { getDb } from "./db";
import { getDeviceId } from "./deviceId";
import type { DraftEntry, StoredPhoto, UserCopy, UserCopyStatus } from "./schema";

function newId(): string {
  return crypto.randomUUID();
}

export type AddCopyInput = {
  variantPublicId: string;
  itemPublicId: string;
  itemTitle: string;
  variantName: string;
  year: number | null;
  category: string;
  provenanceType: string;
  photoBlob?: Blob;
  /** Defaults to "owned": the aisle-check "Add to collection" action. The
   * wantlist action (addToWantlist, below) is the same write with "wanted"
   * instead, so a wantlist row is a collection row, not a second shape
   * (F60: the wantlist is a view of the collection, sharing its columns). */
  status?: UserCopyStatus;
};

export async function addCopy(input: AddCopyInput): Promise<UserCopy> {
  const db = await getDb();
  const deviceId = await getDeviceId();
  const createdAt = new Date().toISOString();
  const id = newId();

  let photoId: string | null = null;
  if (input.photoBlob) {
    photoId = newId();
    const photo: StoredPhoto = { id: photoId, copyId: id, blob: input.photoBlob, createdAt };
    await db.put("photos", photo);
  }

  const copy: UserCopy = {
    id,
    variantPublicId: input.variantPublicId,
    itemPublicId: input.itemPublicId,
    itemTitle: input.itemTitle,
    variantName: input.variantName,
    year: input.year,
    category: input.category,
    provenanceType: input.provenanceType,
    unfiledIdentifier: null,
    status: input.status ?? "owned",
    photoId,
    createdAt,
    deviceId,
  };
  await writeCopy(copy);
  return copy;
}

// The wantlist action on NOT IN COLLECTION, beside "Add to collection":
// same write, status "wanted" instead of "owned". Kept as its own function
// so the check screen's call sites read as what they mean.
export async function addToWantlist(input: Omit<AddCopyInput, "status">): Promise<UserCopy> {
  return addCopy({ ...input, status: "wanted" });
}

// The third door on NOT IN COLLECTION when nothing resolved at all: save
// the identifier and whatever title the user typed as an Unfiled copy, no
// catalogue variant attached. Mirrors the nullable-variant shape PLAN.md
// gives the server-side user_copy table for exactly this case.
export type AddUnfiledInput = {
  identifier: string;
  title: string;
};

export async function addUnfiledCopy(input: AddUnfiledInput): Promise<UserCopy> {
  const deviceId = await getDeviceId();
  const createdAt = new Date().toISOString();
  const copy: UserCopy = {
    id: newId(),
    variantPublicId: null,
    itemPublicId: null,
    itemTitle: input.title,
    variantName: null,
    year: null,
    category: "unfiled",
    provenanceType: "unknown",
    unfiledIdentifier: input.identifier || null,
    status: "owned",
    photoId: null,
    createdAt,
    deviceId,
  };
  await writeCopy(copy);
  return copy;
}

async function writeCopy(copy: UserCopy): Promise<void> {
  const db = await getDb();
  await db.put("userCopies", copy);

  const opId = newId();
  const createdAt = new Date().toISOString();
  await db.put("outbox", {
    opId,
    kind: "add_copy",
    payload: copy,
    createdAt,
    status: "pending",
  });

  // Best-effort, fire-and-forget: a network call may refine state but must
  // never gate this write. If it fails (offline, throttled, unreachable),
  // the op stays "pending" and replayOutbox sends it later.
  void sendOp(opId, copy.deviceId, "add_copy", copy).catch(() => {});
}

// The second door: a locally-saved start on a new catalogue entry. Full
// entry creation is contributor-trust scope (a later slice); this makes the
// door do something real and recoverable now instead of nothing.
export async function saveDraftEntry(input: { title: string; identifier: string | null }): Promise<DraftEntry> {
  const db = await getDb();
  const deviceId = await getDeviceId();
  const draft: DraftEntry = {
    id: newId(),
    title: input.title,
    identifier: input.identifier,
    createdAt: new Date().toISOString(),
    deviceId,
  };
  await db.put("draftEntries", draft);
  return draft;
}

async function sendOp(opId: string, deviceId: string, kind: string, payload: unknown): Promise<void> {
  const res = await fetch("/api/sync/ops", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ opId, deviceId, kind, payload }),
  });
  if (!res.ok) throw new Error(`op send failed: ${res.status}`);
  const db = await getDb();
  const op = await db.get("outbox", opId);
  if (op) await db.put("outbox", { ...op, status: "applied" });
}

// Called on reconnect (the browser "online" event) and once on load, so an
// op queued while offline is replayed rather than lost. Safe to call any
// number of times: the server dedupes on the operation id's primary key.
export async function replayOutbox(): Promise<{ sent: number; failed: number }> {
  const db = await getDb();
  const deviceId = await getDeviceId();
  const pending = (await db.getAll("outbox")).filter((op) => op.status === "pending");
  let sent = 0;
  let failed = 0;
  for (const op of pending) {
    try {
      await sendOp(op.opId, deviceId, op.kind, op.payload);
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

export async function listCopies(): Promise<UserCopy[]> {
  const db = await getDb();
  const all = await db.getAll("userCopies");
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCopy(id: string): Promise<UserCopy | undefined> {
  const db = await getDb();
  return db.get("userCopies", id);
}

// Looked up when a verdict is OWNED, so the slab can render this specific
// copy's own cached photograph (F5) rather than trying to infer one from
// catalogue data, which never carries a photo. Filtered to "owned": the
// same variant can also carry a "wanted" row (added to the wantlist before
// or after this one), and the byVariant index is not unique, so this picks
// the owned row specifically rather than whichever one the index returns
// first.
export async function getCopyByVariant(variantPublicId: string): Promise<UserCopy | undefined> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("userCopies", "byVariant", variantPublicId);
  return rows.find((r) => r.status === "owned");
}

// Only "owned" rows count toward the OWNED verdict: a wantlist entry
// (status "wanted") must never make the check screen tell someone they
// already have something they have only marked wanting.
export async function listOwnedVariantIds(): Promise<Set<string>> {
  const copies = await listCopies();
  const ids = copies
    .filter((c) => c.status === "owned")
    .map((c) => c.variantPublicId)
    .filter((id): id is string => id !== null);
  return new Set(ids);
}

export async function listDraftEntries(): Promise<DraftEntry[]> {
  const db = await getDb();
  const all = await db.getAll("draftEntries");
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPhoto(photoId: string): Promise<StoredPhoto | undefined> {
  const db = await getDb();
  return db.get("photos", photoId);
}
