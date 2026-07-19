import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, deliverablesTable } from "@workspace/db";
import {
  ListDeliverablesParams,
  CreateDeliverableParams,
  CreateDeliverableBody,
  UpdateDeliverableParams,
  UpdateDeliverableBody,
  DeleteDeliverableParams,
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

// GET /projects/:projectId/deliverables
router.get("/projects/:projectId/deliverables", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListDeliverablesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const deliverables = await db
    .select()
    .from(deliverablesTable)
    .where(eq(deliverablesTable.projectId, params.data.projectId))
    .orderBy(asc(deliverablesTable.createdAt));
  res.json(deliverables);
});

// POST /projects/:projectId/deliverables
router.post("/projects/:projectId/deliverables", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CreateDeliverableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateDeliverableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [deliverable] = await db
    .insert(deliverablesTable)
    .values({ ...parsed.data, projectId: params.data.projectId })
    .returning();
  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "deliverable_added",
    entityType: "deliverable",
    entityId: deliverable.id,
    summary: `Added deliverable: "${deliverable.title}"`,
  });
  res.status(201).json(deliverable);
});

// PATCH /projects/:projectId/deliverables/:id
router.patch("/projects/:projectId/deliverables/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateDeliverableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDeliverableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [deliverable] = await db
    .update(deliverablesTable)
    .set(parsed.data)
    .where(and(eq(deliverablesTable.id, params.data.id), eq(deliverablesTable.projectId, params.data.projectId)))
    .returning();
  if (!deliverable) {
    res.status(404).json({ error: "Deliverable not found" });
    return;
  }
  if (parsed.data.status) {
    await logEvent({
      projectId: params.data.projectId,
      userId,
      actionType: "deliverable_moved",
      entityType: "deliverable",
      entityId: deliverable.id,
      summary: `"${deliverable.title}" moved to ${deliverable.status}`,
    });
  }
  res.json(deliverable);
});

// DELETE /projects/:projectId/deliverables/:id
router.delete("/projects/:projectId/deliverables/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteDeliverableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [deliverable] = await db
    .delete(deliverablesTable)
    .where(and(eq(deliverablesTable.id, params.data.id), eq(deliverablesTable.projectId, params.data.projectId)))
    .returning();
  if (!deliverable) {
    res.status(404).json({ error: "Deliverable not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
