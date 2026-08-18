// Applies pending migrations from src/db/migrations against DATABASE_URL_UNPOOLED
// (falling back to DATABASE_URL, then the local Docker default). Run with
// `npm run db:migrate`.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolveDatabaseUrl } from "../../src/db/connection";

const connectionString = resolveDatabaseUrl(true);

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  console.log("Applying migrations from src/db/migrations ...");
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  console.log("Migrations applied.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
