import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Local Docker Postgres default (docker-compose.yml), used only when
// DATABASE_URL is unset outside production. Never a production credential:
// production always sets DATABASE_URL through the deploy environment, never
// through a file in this repository.
const LOCAL_DEV_DEFAULT =
  "postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine";

const connectionString =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "production" ? undefined : LOCAL_DEV_DEFAULT);

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. See .env.example for the shape and " +
      ".forge/OPERATOR.md for where the production value comes from.",
  );
}

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
