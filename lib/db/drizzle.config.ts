import { defineConfig } from "drizzle-kit";
import path from "path";

// `generate` diffs the schema against the migration snapshots and never opens a
// connection, so it must work without DATABASE_URL. `migrate` and `push` do
// connect, and drizzle-kit surfaces its own error if the URL is missing.
const url = process.env.DATABASE_URL ?? "";

// Mirrors the pool in src/index.ts: Supabase requires TLS, a local Postgres
// generally isn't listening for it.
const isLocal = /(?:@|\/\/)(?:localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  },
});
