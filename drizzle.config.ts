import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
const needsDatabaseConnection = process.argv.some((arg) =>
  /(?:migrate|push|studio|introspect)/.test(arg),
);

if (!databaseUrl && needsDatabaseConnection) {
  throw new Error("DATABASE_URL is required for Drizzle database commands");
}

const configDatabaseUrl =
  databaseUrl ?? "postgres://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: configDatabaseUrl,
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },
  strict: true,
  verbose: true,
});
