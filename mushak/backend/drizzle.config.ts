import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy mushak/backend/.env.example to mushak/backend/.env.",
  );
}

/**
 * Migrations live in the shared database package so every suite app uses one
 * schema and one history. This config stays in the backend because that is
 * where the env file and the docker compose stack live.
 */
export default defineConfig({
  schema: "../../packages/db/src/schema.ts",
  out: "../../packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
