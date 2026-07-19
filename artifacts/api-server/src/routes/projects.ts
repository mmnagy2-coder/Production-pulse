import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenesTable,
  shootDaysTable,
  takesTable,
  deliverablesTable,
  evidenceLogTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
  GetProjectSummaryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { logEvent } from "../lib/evidenceLogger";

const router: IRouter = Router();

// GET /projects
router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(projectsTable.updatedAt);
  res.json(projects);
});

// POST /projects
router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values({ ...parsed.data, userId })
    .returning();
  await logEvent({
    projectId: project.id,
    userId,
    actionType: "project_created",
    entityType: "project",
    entityId: project.id,
    summary: `Created project "${project.title}"`,
  });
  res.status(201).json(project);
});

// GET /projects/:id
router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// PATCH /projects/:id
router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// DELETE /projects/:id
router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

// GET /projects/:id/summary
router.get("/projects/:id/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetProjectSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const id = params.data.id;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [sceneCountRow] = await db
    .select({ value: count() })
    .from(scenesTable)
    .where(eq(scenesTable.projectId, id));
  const [scheduledCountRow] = await db
    .select({ value: count() })
    .from(scenesTable)
    .where(and(eq(scenesTable.projectId, id), sql`${scenesTable.shootDayId} IS NOT NULL`));
  const [shootDayCountRow] = await db
    .select({ value: count() })
    .from(shootDaysTable)
    .where(eq(shootDaysTable.projectId, id));
  const [takeCountRow] = await db
    .select({ value: count() })
    .from(takesTable)
    .where(eq(takesTable.projectId, id));
  const [circledTakeCountRow] = await db
    .select({ value: count() })
    .from(takesTable)
    .where(and(eq(takesTable.projectId, id), eq(takesTable.circled, true)));
  const [deliverableCountRow] = await db
    .select({ value: count() })
    .from(deliverablesTable)
    .where(eq(deliverablesTable.projectId, id));
  const [evidenceCountRow] = await db
    .select({ value: count() })
    .from(evidenceLogTable)
    .where(eq(evidenceLogTable.projectId, id));

  res.json({
    id: project.id,
    title: project.title,
    currentStage: project.currentStage,
    sceneCount: Number(sceneCountRow?.value ?? 0),
    scheduledSceneCount: Number(scheduledCountRow?.value ?? 0),
    shootDayCount: Number(shootDayCountRow?.value ?? 0),
    takeCount: Number(takeCountRow?.value ?? 0),
    circledTakeCount: Number(circledTakeCountRow?.value ?? 0),
    deliverableCount: Number(deliverableCountRow?.value ?? 0),
    evidenceLogCount: Number(evidenceCountRow?.value ?? 0),
  });
});

export default router;
