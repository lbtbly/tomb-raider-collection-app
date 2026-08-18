import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./connection";

const connectionString = resolveDatabaseUrl();

// One connection pool per process. Next.js dev reuses this across hot
// reloads via globalThis so the connection count does not climb on every
// edit.
const globalForDb = globalThis as unknown as {
  __vitrinePg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__vitrinePg ??
  postgres(connectionString, { max: process.env.NODE_ENV === "production" ? 5 : 3 });

if (process.env.NODE_ENV !== "production") globalForDb.__vitrinePg = client;

export const db = drizzle(client, { schema });
export * as schema from "./schema";
