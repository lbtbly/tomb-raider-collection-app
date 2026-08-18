import { defineConfig } from "drizzle-kit";

// Local Docker Postgres default (docker-compose.yml). Production always sets
// DATABASE_URL_UNPOOLED through the deploy environment; this repository
// holds no credential file. See .env.example and .forge/OPERATOR.md.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgres://vitrine:vitrine_dev_only@localhost:5433/vitrine";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
