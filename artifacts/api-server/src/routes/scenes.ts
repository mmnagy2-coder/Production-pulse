import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, scenesTable } from "@workspace/db";
import {
  ListScenesParams,
  CreateSceneParams,
  CreateSceneBody,
  GetSceneParams,
  UpdateSceneParams,
  UpdateSceneBody,
  DeleteSceneParams,
  RunBreakdownParams,
  RunBreakdownBody,
  AcceptBreakdownParams,
  AcceptBreakdownBody,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";
import { logEvent } from "../lib/evidenceLogger";
import { getAnthropicClient, isAiAvailable } from "../lib/anthropic";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function assertProjectOwner(projectId: number, userId: string): Promise<boolean> {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return !!project;
}

// GET /projects/:projectId/scenes
router.get("/projects/:projectId/scenes", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListScenesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const scenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.projectId, params.data.projectId))
    .orderBy(asc(scenesTable.sceneNumber));
  res.json(scenes);
});

// POST /projects/:projectId/scenes
router.post("/projects/:projectId/scenes", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CreateSceneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateSceneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [scene] = await db
    .insert(scenesTable)
    .values({ ...parsed.data, projectId: params.data.projectId })
    .returning();
  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "scene_created",
    entityType: "scene",
    entityId: scene.id,
    summary: `Added scene ${scene.sceneNumber}: ${scene.heading}`,
  });
  res.status(201).json(scene);
});

// GET /projects/:projectId/scenes/:id
router.get("/projects/:projectId/scenes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetSceneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [scene] = await db
    .select()
    .from(scenesTable)
    .where(and(eq(scenesTable.id, params.data.id), eq(scenesTable.projectId, params.data.projectId)));
  if (!scene) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }
  res.json(scene);
});

// PATCH /projects/:projectId/scenes/:id
router.patch("/projects/:projectId/scenes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateSceneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSceneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [scene] = await db
    .update(scenesTable)
    .set({ ...parsed.data, corrected: true })
    .where(and(eq(scenesTable.id, params.data.id), eq(scenesTable.projectId, params.data.projectId)))
    .returning();
  if (!scene) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }
  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "scene_corrected",
    entityType: "scene",
    entityId: scene.id,
    summary: `Corrected scene ${scene.sceneNumber}: ${scene.heading}`,
  });
  res.json(scene);
});

// DELETE /projects/:projectId/scenes/:id
router.delete("/projects/:projectId/scenes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteSceneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [scene] = await db
    .delete(scenesTable)
    .where(and(eq(scenesTable.id, params.data.id), eq(scenesTable.projectId, params.data.projectId)))
    .returning();
  if (!scene) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }
  res.sendStatus(204);
});

// POST /projects/:projectId/breakdown
router.post("/projects/:projectId/breakdown", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = RunBreakdownParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RunBreakdownBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!isAiAvailable()) {
    res.status(503).json({ scenes: [], aiAvailable: false, message: "AI unavailable — add scenes manually." });
    return;
  }

  const client = getAnthropicClient();
  if (!client) {
    res.status(503).json({ scenes: [], aiAvailable: false, message: "AI unavailable — add scenes manually." });
    return;
  }

  try {
    const scriptText = parsed.data.scriptText;
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an experienced script supervisor breaking down a screenplay. Analyse the following screenplay and extract every scene. For each scene return a JSON object with these exact fields:
- sceneNumber (integer, sequential)
- heading (string, the full scene heading e.g. "INT. KITCHEN - DAY")
- intExt (string, one of: "INT", "EXT", "INT/EXT")
- dayNight (string, one of: "DAY", "NIGHT", "DAWN", "DUSK", "CONTINUOUS")
- location (string, just the location name e.g. "KITCHEN")
- durationPages (number, estimated page count as decimal e.g. 0.5, 1, 2.5)
- summary (string, one sentence describing the scene's dramatic action)
- characters (array of strings, character names who appear or speak)
- props (array of strings, significant props mentioned or implied)
- costumes (array of strings, specific costume items mentioned)

Return ONLY a JSON array of scene objects. No markdown, no explanation, just the JSON array.

Be deliberate: film students must check and correct your work, so it is acceptable to miss some props or costumes — that is part of the learning. Do not invent characters or props not in the text.

SCREENPLAY:
${scriptText.slice(0, 20000)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from AI");
    }

    let scenes: unknown[];
    try {
      scenes = JSON.parse(content.text);
    } catch {
      // Try to extract JSON from the response
      const match = content.text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Could not parse AI response as JSON");
      scenes = JSON.parse(match[0]);
    }

    await logEvent({
      projectId: params.data.projectId,
      userId,
      actionType: "breakdown_run",
      entityType: "project",
      entityId: params.data.projectId,
      summary: `Ran AI script breakdown — ${scenes.length} scenes identified`,
    });

    res.json({ scenes, aiAvailable: true, message: null });
  } catch (err) {
    logger.error({ err }, "AI breakdown failed");
    res.status(503).json({ scenes: [], aiAvailable: false, message: "AI is temporarily unavailable. You can add scenes manually." });
  }
});

// POST /projects/:projectId/breakdown/accept
router.post("/projects/:projectId/breakdown/accept", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = AcceptBreakdownParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AcceptBreakdownBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Delete existing AI-generated scenes before accepting new batch
  await db
    .delete(scenesTable)
    .where(and(eq(scenesTable.projectId, params.data.projectId), eq(scenesTable.aiGenerated, true)));

  const scenes = await db
    .insert(scenesTable)
    .values(
      parsed.data.scenes.map((s) => ({
        ...s,
        projectId: params.data.projectId,
        aiGenerated: true,
        corrected: false,
        characters: s.characters ?? [],
        props: s.props ?? [],
        costumes: s.costumes ?? [],
      })),
    )
    .returning();

  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "breakdown_accepted",
    entityType: "project",
    entityId: params.data.projectId,
    summary: `Accepted AI breakdown — ${scenes.length} scenes saved`,
  });

  res.status(201).json(scenes);
});

export default router;
