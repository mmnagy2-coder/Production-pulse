import { defineConfig } from "drizzle-kit";
import path from "path";

// `generate` diffs the schema against the migration snapshots and never opens a
// connection, so it must work without DATABASE_URL. `migrate` and `push` do
// connect, and drizzle-kit surfaces its own error if the URL is missing.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
    ssl: { rejectUnauthorized: false },
  },
});
