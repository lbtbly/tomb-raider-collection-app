import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/db/connection";

// Local Docker Postgres default (docker-compose.yml) unless production sets
// DATABASE_URL_UNPOOLED through the deploy environment; this repository
// holds no credential file. See .env.example and .forge/OPERATOR.md.
const url = resolveDatabaseUrl(true);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
