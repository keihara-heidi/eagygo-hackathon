import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const getDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to Supabase Postgres");
  }

  return databaseUrl;
};

type SqlClient = ReturnType<typeof postgres>;

const globalForDb = globalThis as typeof globalThis & {
  postgresSqlClient?: SqlClient;
};

export const sqlClient =
  globalForDb.postgresSqlClient ??
  postgres(getDatabaseUrl(), {
    max: 10,
    prepare: false,
    ssl: process.env.DATABASE_SSL === "false" ? false : "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresSqlClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
