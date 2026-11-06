import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./db/schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy mushak/backend/.env.example to mushak/backend/.env.",
  );
}

/**
 * Serverless-friendly Postgres client.
 *
 * - `max: 1` keeps one short-lived connection per function/app instance, which
 *   is what serverless platforms expect (the platform scales horizontally, not
 *   the pool).
 * - `prepare: false` is required by transaction-mode poolers such as PgBouncer,
 *   Neon and Supabase, which cannot reuse prepared statements across requests.
 * - An idle timeout lets the platform reclaim sockets instead of keeping the
 *   function warm.
 */
export const client = postgres(connectionString, {
  max: 1,
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
