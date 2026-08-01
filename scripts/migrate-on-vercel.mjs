import { spawnSync } from "node:child_process";

const shouldRunMigrations =
  process.env.VERCEL === "1" || process.env.FORCE_DB_MIGRATE === "1";

if (!shouldRunMigrations) {
  console.log("Skipping database migrations outside Vercel build.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run database migrations.");
  process.exit(1);
}

const result = spawnSync("bun", ["x", "drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
