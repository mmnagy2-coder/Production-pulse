import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, reviewCutsTable, cutCommentsTable } from "@workspace/db";
import {
  ListCutsParams,
  CreateCutParams,
  CreateCutBody,
  UpdateCutParams,
  UpdateCutBody,
  DeleteCutParams,
  ListCutCommentsParams,
  AddCutCommentParams,
  AddCutCommentBody,
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

// GET /projects/:projectId/cuts
router.get("/projects/:projectId/cuts", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListCutsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const cuts = await db
    .select()
    .from(reviewCutsTable)
    .where(eq(reviewCutsTable.projectId, params.data.projectId))
    .orderBy(desc(reviewCutsTable.createdAt));

  // Add comment counts
  const cutsWithCounts = await Promise.all(
    cuts.map(async (cut) => {
      const [countRow] = await db
        .select({ value: count() })
        .from(cutCommentsTable)
        .where(eq(cutCommentsTable.cutId, cut.id));
      return { ...cut, commentCount: Number(countRow?.value ?? 0) };
    }),
  );
  res.json(cutsWithCounts);
});

// POST /projects/:projectId/cuts
router.post("/projects/:projectId/cuts", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CreateCutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [cut] = await db
    .insert(reviewCutsTable)
    .values({ ...parsed.data, projectId: params.data.projectId })
    .returning();
  res.status(201).json({ ...cut, commentCount: 0 });
});

// PATCH /projects/:projectId/cuts/:id
router.patch("/projects/:projectId/cuts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateCutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [cut] = await db
    .update(reviewCutsTable)
    .set(parsed.data)
    .where(and(eq(reviewCutsTable.id, params.data.id), eq(reviewCutsTable.projectId, params.data.projectId)))
    .returning();
  if (!cut) {
    res.status(404).json({ error: "Cut not found" });
    return;
  }
  if (parsed.data.status) {
    await logEvent({
      projectId: params.data.projectId,
      userId,
      actionType: "cut_status_changed",
      entityType: "cut",
      entityId: cut.id,
      summary: `Cut "${cut.title}" status → ${cut.status}`,
    });
  }
  const [countRow] = await db.select({ value: count() }).from(cutCommentsTable).where(eq(cutCommentsTable.cutId, cut.id));
  res.json({ ...cut, commentCount: Number(countRow?.value ?? 0) });
});

// DELETE /projects/:projectId/cuts/:id
router.delete("/projects/:projectId/cuts/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteCutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [cut] = await db
    .delete(reviewCutsTable)
    .where(and(eq(reviewCutsTable.id, params.data.id), eq(reviewCutsTable.projectId, params.data.projectId)))
    .returning();
  if (!cut) {
    res.status(404).json({ error: "Cut not found" });
    return;
  }
  res.sendStatus(204);
});

// GET /projects/:projectId/cuts/:id/comments
router.get("/projects/:projectId/cuts/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListCutCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Verify cut exists AND belongs to this project AND the user owns the project — single query
  const [cut] = await db
    .select({ id: reviewCutsTable.id })
    .from(reviewCutsTable)
    .innerJoin(projectsTable, eq(projectsTable.id, reviewCutsTable.projectId))
    .where(
      and(
        eq(reviewCutsTable.id, params.data.id),
        eq(reviewCutsTable.projectId, params.data.projectId),
        eq(projectsTable.userId, userId),
      ),
    );
  if (!cut) {
    res.status(404).json({ error: "Cut not found" });
    return;
  }
  const comments = await db
    .select()
    .from(cutCommentsTable)
    .where(eq(cutCommentsTable.cutId, params.data.id))
    .orderBy(cutCommentsTable.pinNumber);
  res.json(comments);
});

// POST /projects/:projectId/cuts/:id/comments
router.post("/projects/:projectId/cuts/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = AddCutCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddCutCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Verify cut exists AND belongs to this project AND the user owns the project — single query
  const [cut] = await db
    .select({ id: reviewCutsTable.id })
    .from(reviewCutsTable)
    .innerJoin(projectsTable, eq(projectsTable.id, reviewCutsTable.projectId))
    .where(
      and(
        eq(reviewCutsTable.id, params.data.id),
        eq(reviewCutsTable.projectId, params.data.projectId),
        eq(projectsTable.userId, userId),
      ),
    );
  if (!cut) {
    res.status(404).json({ error: "Cut not found" });
    return;
  }
  // Determine next pin number
  const existing = await db
    .select({ value: count() })
    .from(cutCommentsTable)
    .where(eq(cutCommentsTable.cutId, params.data.id));
  const pinNumber = Number(existing[0]?.value ?? 0) + 1;
  const [comment] = await db
    .insert(cutCommentsTable)
    .values({ ...parsed.data, cutId: params.data.id, pinNumber })
    .returning();
  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "review_comment_added",
    entityType: "cut",
    entityId: params.data.id,
    summary: `Added review comment pin #${pinNumber} on cut`,
  });
  res.status(201).json(comment);
});

export default router;
