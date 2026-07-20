import { Router, type IRouter } from "express";
import { createDemoProject } from "../lib/demoSeed";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

/**
 * POST /seed-demo
 *
 * Creates a full demo project for a brand-new user.
 * Idempotent — returns { alreadySeeded: true } if the user already has projects.
 */
router.post("/seed-demo", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { projectId, seeded } = await createDemoProject(userId);

  if (!seeded || projectId === null) {
    res.json({ alreadySeeded: true });
    return;
  }

  res.status(201).json({ seeded: true, projectId });
});

export default router;
