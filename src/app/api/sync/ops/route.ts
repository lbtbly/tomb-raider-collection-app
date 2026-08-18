// Write idempotency for the offline outbox (PLAN.md: "Writes carry a
// client-generated operation id. The server keeps applied ids, so a replay
// after reconnect never double-writes.") client_op is already shaped for
// exactly this by the data-layer agent (src/db/schema.ts); this route only
// inserts into it.
//
// Slice 1 is anonymous-only, so this does not yet apply the payload to any
// canonical table -- there is no user_account until slice 3, and an
// anonymous copy's home is the device, not the server (DESIGN.md note 2).
// What this closes now is the idempotency contract itself: replay the same
// operation id any number of times and exactly one client_op row exists for
// it, which is what F15 counts.

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const MAX_PAYLOAD_BYTES = 8_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  const { opId, deviceId, kind, payload } = (body ?? {}) as Record<string, unknown>;

  if (typeof opId !== "string" || !/^[0-9a-f-]{36}$/i.test(opId)) {
    return Response.json({ error: "opId must be a UUID" }, { status: 400 });
  }
  if (typeof deviceId !== "string" || deviceId.length === 0 || deviceId.length > 80) {
    return Response.json({ error: "deviceId is required" }, { status: 400 });
  }
  if (typeof kind !== "string" || kind.length === 0 || kind.length > 40) {
    return Response.json({ error: "kind is required" }, { status: 400 });
  }
  if (JSON.stringify(payload ?? {}).length > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  await db
    .insert(schema.clientOp)
    .values({ id: opId, deviceId, kind, payload: payload ?? {} })
    .onConflictDoNothing({ target: schema.clientOp.id });

  const rows = await db
    .select({ id: schema.clientOp.id })
    .from(schema.clientOp)
    .where(eq(schema.clientOp.id, opId));

  return Response.json({ opId, applied: true, storedCount: rows.length });
}
