import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, evidenceLogTable } from "@workspace/db";
import { ListEvidenceLogParams } from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

// GET /projects/:projectId/evidence-log
router.get("/projects/:projectId/evidence-log", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListEvidenceLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const entries = await db
    .select()
    .from(evidenceLogTable)
    .where(eq(evidenceLogTable.projectId, params.data.projectId))
    .orderBy(desc(evidenceLogTable.createdAt))
    .limit(200);
  const total = entries.length;
  res.json({ entries, total, limit: 200, offset: 0 });
});

export default router;
