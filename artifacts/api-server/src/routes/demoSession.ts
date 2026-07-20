import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { createDemoProject } from "../lib/demoSeed";

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
 * Starts a new demo session, sets a session cookie, and immediately seeds a
 * demo project for that session so the user has something to explore the
 * moment they land on the dashboard.
 */
router.post("/demo-session", async (req, res): Promise<void> => {
  let demoUserId = req.cookies?.[DEMO_COOKIE] as string | undefined;
  let isNew = false;

  if (!demoUserId || !demoUserId.startsWith("demo_")) {
    demoUserId = makeDemoUserId();
    isNew = true;
  }

  res.cookie(DEMO_COOKIE, demoUserId, getCookieOptions());

  const { projectId, seeded } = await createDemoProject(demoUserId);

  res.status(201).json({
    demoUserId,
    projectId,
    seeded: isNew ? seeded : false,
  });
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
