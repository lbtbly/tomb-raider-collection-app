// Shape of the on-device stores. See src/lib/device/db.ts for the idb
// database itself and PLAN.md's offline boundary for the contract these
// exist to satisfy: a compact catalogue index, the user's own copies in
// full, thumbnails as blobs, an outbox of pending writes, and a meta record
// holding the sync cursor and the anonymous device id.

// One row per variant, denormalised so a single-store, single-index lookup
// resolves a scanned or typed identifier with no join. F14 budgets this
// shape at 400 KB compressed at 4,000 variants.
export type CatalogueIndexRow = {
  variantPublicId: string;
  itemPublicId: string;
  title: string;
  year: number | null;
  category: string;
  variantName: string;
  provenanceType: string;
  /** {kind, normalized} pairs, kept for display (e.g. "barcode_ean13"). */
  identifiers: { kind: string; normalized: string }[];
  /** Flattened normalized values only, indexed with multiEntry for O(1)
   * identifier lookup without scanning every row. */
  normalizedIdentifiers: string[];
  updatedAt: string;
};

export type SyncMeta = {
  key: "sync";
  cursor: string | null;
  lastSyncedAt: string | null;
  /** The server's sync_epoch value as of the last successful sync. A
   * mismatch against what the server reports next time forces a full
   * resync rather than a delta (see src/lib/device/syncProtocol.ts): this
   * is what lets a device converge after the catalogue is rebuilt
   * wholesale, without a human clearing storage. Null before the first
   * sync ever completes, which the server also reads as "no epoch on
   * record" and answers with a full resync. */
  epoch: string | null;
};

export type DeviceMeta = {
  key: "device";
  deviceId: string;
};

export type MetaRow = SyncMeta | DeviceMeta;

// A copy the user has added to their own, on-device collection. Anonymous
// mode writes only here; nothing leaves the device until an account claims
// it (PLAN.md, "The wall sits after the work").
//
// variantPublicId is nullable for exactly the case PLAN.md's schema names
// for the server-side user_copy table (`CHECK (variant_id IS NOT NULL OR
// unfiled_title IS NOT NULL)`): the third door on NOT IN COLLECTION, "add to
// Unfiled", saves a copy with no resolved catalogue variant at all.
// Mirrors user_copy.status from PLAN.md's server schema (owned | wanted |
// ordered | sold | for_trade) rather than inventing a device-only value
// set: F60 requires the wantlist to be a view of the collection sharing its
// columns, which only holds if a wantlist row is a collection row with this
// field set to "wanted", not a second, parallel shape.
export type UserCopyStatus = "owned" | "wanted" | "ordered" | "sold" | "for_trade";

export type UserCopy = {
  id: string;
  variantPublicId: string | null;
  itemPublicId: string | null;
  itemTitle: string;
  variantName: string | null;
  year: number | null;
  category: string;
  provenanceType: string;
  unfiledIdentifier: string | null;
  status: UserCopyStatus;
  photoId: string | null;
  createdAt: string;
  deviceId: string;
};

// A locally-saved start on a new catalogue entry: the "start an entry" door
// on NOT IN COLLECTION. Full entry creation (publish then review, against
// the suggestion/revision tables) is contributor-trust scope; this exists
// so pressing that door does something real and recoverable now, rather
// than nothing or a placeholder screen.
export type DraftEntry = {
  id: string;
  title: string;
  identifier: string | null;
  createdAt: string;
  deviceId: string;
};

export type StoredPhoto = {
  id: string;
  copyId: string;
  blob: Blob;
  createdAt: string;
};

// A pending write with a client-generated operation id, so a replay after
// reconnect never double-writes (PLAN.md). Slice 1 only ever writes
// "add_copy" ops; the outbox exists now so slice 3's sync drains a real
// queue rather than inventing one at claim time.
export type OutboxOp = {
  opId: string;
  kind: "add_copy";
  payload: UserCopy;
  createdAt: string;
  status: "pending" | "sent" | "applied";
};
