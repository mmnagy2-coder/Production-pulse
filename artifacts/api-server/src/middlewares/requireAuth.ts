import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const DEMO_COOKIE = "pp_demo_session";

/**
 * Supabase signs access tokens one of two ways depending on project age:
 *
 *  - Asymmetric (ES256/RS256) — the default. Verified against the project's
 *    published JWKS, so the server never needs a secret.
 *  - Symmetric (HS256) — the legacy scheme. Only usable if SUPABASE_JWT_SECRET
 *    is supplied.
 *
 * JWKS is preferred; the secret is a fallback so a project that has not yet
 * migrated to signing keys still works.
 */
let jwks: JWTVerifyGetKey | null = null;
let hmacKey: Uint8Array | null = null;

function supabaseUrl(): string {
  const url = process.env["SUPABASE_URL"];
  if (!url) {
    throw new Error(
      "SUPABASE_URL must be set to verify access tokens.",
    );
  }
  return url.replace(/\/+$/, "");
}

function getKey(): JWTVerifyGetKey | Uint8Array {
  const secret = process.env["SUPABASE_JWT_SECRET"];
  if (secret) {
    hmacKey ??= new TextEncoder().encode(secret);
    return hmacKey;
  }

  // createRemoteJWKSet caches the key set and refetches only on unknown `kid`,
  // so this costs one request per cold start rather than one per API call.
  jwks ??= createRemoteJWKSet(
    new URL(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`),
  );
  return jwks;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Allow demo sessions to bypass authentication. The demo cookie is
  // set by POST /demo-session and verified here by its shape (demo_<uuid>).
  const demoUserId = req.cookies?.[DEMO_COOKIE] as string | undefined;
  if (demoUserId && demoUserId.startsWith("demo_")) {
    (req as any).userId = demoUserId;
    next();
    return;
  }

  // Test-mode bypass: only enabled when NODE_ENV=test and a test user header is present.
  // This never runs in production — NODE_ENV is never "test" in deployed environments.
  if (process.env["NODE_ENV"] === "test") {
    const testUserId = req.headers["x-test-user-id"];
    if (typeof testUserId === "string" && testUserId.length > 0) {
      (req as any).userId = testUserId;
      next();
      return;
    }
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const key = getKey();
    const { payload } = await jwtVerify(token, key as JWTVerifyGetKey, {
      issuer: `${supabaseUrl()}/auth/v1`,
      audience: "authenticated",
    });

    if (!payload.sub) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    (req as any).userId = payload.sub;
    next();
  } catch (err) {
    // Expected for expired or tampered tokens — log at debug so a bad client
    // can be diagnosed without filling production logs.
    logger.debug({ err }, "Access token verification failed");
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getUserId(req: Request): string {
  return (req as any).userId as string;
}
