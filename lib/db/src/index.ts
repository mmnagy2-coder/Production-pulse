import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Lambda-style runtimes freeze between invocations, so a large pool just
// accumulates connections Supabase will eventually refuse. One connection per
// warm instance is the right shape there; a normal long-lived server wants more.
const isServerless = !!process.env["AWS_LAMBDA_FUNCTION_NAME"];

function isLocalHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

// Supabase requires TLS. `rejectUnauthorized: false` encrypts the connection but
// does not verify the server certificate chain — node-postgres does not trust
// Supabase's CA out of the box. To verify properly, download the project CA cert
// from Supabase (Settings -> Database -> SSL Configuration) and pass it as
// `ssl: { ca: readFileSync(process.env.DATABASE_CA_CERT) }` instead.
const ssl = isLocalHost(connectionString)
  ? false
  : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString,
  ssl,
  max: isServerless ? 1 : 10,
  // Don't hold a connection open across a frozen invocation.
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: isServerless,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
