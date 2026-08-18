// Mirrors variant_identifier.normalized exactly: the Postgres generated
// column is `lower(regexp_replace(value, '[^a-zA-Z0-9]', '', 'g'))` (see
// src/db/schema.ts). This is the client-side twin, because the offline
// check screen matches a scanned or typed value against the on-device
// catalogue index with no server round trip, and the two normalization
// routines must never drift or a value that matches server-side could miss
// on-device, or the reverse.
export function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
