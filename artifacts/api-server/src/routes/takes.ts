import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, takesTable } from "@workspace/db";
import {
  ListTakesParams,
  LogTakeParams,
  LogTakeBody,
  UpdateTakeParams,
  UpdateTakeBody,
  ListCircledTakesParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { logEvent } from "../lib/evidenceLogger";

const router: IRouter = Router();

async function assertProjectOwner(projectId: number, userId: string): Promise<boolean> {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return !!project;
}

// GET /projects/:projectId/takes
router.get("/projects/:projectId/takes", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListTakesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const takes = await db
    .select()
    .from(takesTable)
    .where(eq(takesTable.projectId, params.data.projectId))
    .orderBy(desc(takesTable.loggedAt));
  res.json(takes);
});

// POST /projects/:projectId/takes
router.post("/projects/:projectId/takes", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = LogTakeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = LogTakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [take] = await db
    .insert(takesTable)
    .values({ ...parsed.data, projectId: params.data.projectId })
    .returning();
  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: take.circled ? "take_circled" : "take_logged",
    entityType: "take",
    entityId: take.id,
    summary: `Logged Sc.${take.sceneNumber} ${take.shotLabel} T${take.takeNumber}${take.circled ? " [CIRCLED]" : ""}`,
  });
  res.status(201).json(take);
});

// PATCH /projects/:projectId/takes/:id
router.patch("/projects/:projectId/takes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateTakeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [take] = await db
    .update(takesTable)
    .set(parsed.data)
    .where(and(eq(takesTable.id, params.data.id), eq(takesTable.projectId, params.data.projectId)))
    .returning();
  if (!take) {
    res.status(404).json({ error: "Take not found" });
    return;
  }
  if (parsed.data.circled !== undefined) {
    await logEvent({
      projectId: params.data.projectId,
      userId,
      actionType: take.circled ? "take_circled" : "take_uncircled",
      entityType: "take",
      entityId: take.id,
      summary: `${take.circled ? "Circled" : "Uncircled"} Sc.${take.sceneNumber} ${take.shotLabel} T${take.takeNumber}`,
    });
  }
  res.json(take);
});

// GET /projects/:projectId/takes/circled
router.get("/projects/:projectId/takes/circled", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListCircledTakesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const takes = await db
    .select()
    .from(takesTable)
    .where(and(eq(takesTable.projectId, params.data.projectId), eq(takesTable.circled, true)))
    .orderBy(desc(takesTable.loggedAt));
  res.json(takes);
});

export default router;
