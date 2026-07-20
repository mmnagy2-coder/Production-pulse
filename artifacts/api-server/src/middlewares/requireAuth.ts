import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const DEMO_COOKIE = "pp_demo_session";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow demo sessions to bypass Clerk authentication. The demo cookie is
  // set by POST /demo-session and verified here by its shape (demo_<uuid>).
  const demoUserId = req.cookies?.[DEMO_COOKIE] as string | undefined;
  if (demoUserId && demoUserId.startsWith("demo_")) {
    (req as any).userId = demoUserId;
    next();
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

export function getUserId(req: Request): string {
  return (req as any).userId as string;
}
