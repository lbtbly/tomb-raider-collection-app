// The anonymous device id. Minted once, on first use, and stored in the
// same on-device meta store as the sync cursor -- never in an account,
// because slice 1 runs entirely signed out (PLAN.md, "Anonymous mode writes
// only to the device").

import { getDb } from "./db";

function mintDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // crypto.randomUUID needs a secure context; this id gates nothing and is
  // never a capability token, so a lower-quality fallback is acceptable
  // rather than failing the whole check screen over it.
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDeviceId(): Promise<string> {
  const db = await getDb();
  const existing = await db.get("meta", "device");
  if (existing && existing.key === "device") return existing.deviceId;
  const deviceId = mintDeviceId();
  await db.put("meta", { key: "device", deviceId });
  return deviceId;
}
