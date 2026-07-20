import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";

const router: IRouter = Router();

const DEMO_COOKIE = "pp_demo_session";
const DEMO_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

function makeDemoUserId(): string {
  return `demo_${randomUUID()}`;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: DEMO_COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

/**
 * POST /demo-session
 *
 * Starts a new demo session. Sets a session cookie and returns the demo user id.
 * If a demo session already exists, returns the existing user id.
 */
router.post("/demo-session", async (req, res): Promise<void> => {
  const existing = req.cookies?.[DEMO_COOKIE] as string | undefined;
  if (existing && existing.startsWith("demo_")) {
    res.json({ demoUserId: existing });
    return;
  }

  const demoUserId = makeDemoUserId();
  res.cookie(DEMO_COOKIE, demoUserId, getCookieOptions());
  res.status(201).json({ demoUserId });
});

/**
 * GET /me/demo
 *
 * Returns the current demo session user id, if any.
 */
router.get("/me/demo", async (req, res): Promise<void> => {
  const demoUserId = req.cookies?.[DEMO_COOKIE] as string | undefined;
  if (demoUserId && demoUserId.startsWith("demo_")) {
    res.json({ demoUserId });
    return;
  }
  res.json({ demoUserId: null });
});

/**
 * DELETE /demo-session
 *
 * Clears the demo session cookie. Does not delete demo projects; they remain in
 * the database under the demo user id until manually cleaned up.
 */
router.delete("/demo-session", async (req, res): Promise<void> => {
  res.clearCookie(DEMO_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
