import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, scenesTable, shootDaysTable } from "@workspace/db";
import {
  ListShootDaysParams,
  CreateShootDayParams,
  CreateShootDayBody,
  UpdateShootDayParams,
  UpdateShootDayBody,
  DeleteShootDayParams,
  SetDayScheduleParams,
  SetDayScheduleBody,
  GetCallSheetParams,
  RequestAdReviewParams,
  GetScheduleWarningsParams,
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

interface ScheduleWarning {
  type: "idle_actor" | "excessive_locations" | "page_count_overrun";
  severity: "warning" | "error";
  message: string;
  shootDayId: number;
  affectedActors?: string[];
  affectedLocations?: string[];
}

async function computeWarnings(projectId: number): Promise<ScheduleWarning[]> {
  const days = await db
    .select()
    .from(shootDaysTable)
    .where(eq(shootDaysTable.projectId, projectId))
    .orderBy(asc(shootDaysTable.dayNumber));

  const allScenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.projectId, projectId));

  const warnings: ScheduleWarning[] = [];

  // Build map: actor -> list of day numbers they appear
  const actorDays: Map<string, number[]> = new Map();
  for (const scene of allScenes) {
    if (!scene.shootDayId) continue;
    const day = days.find((d) => d.id === scene.shootDayId);
    if (!day) continue;
    for (const char of scene.characters) {
      if (!actorDays.has(char)) actorDays.set(char, []);
      const dayNums = actorDays.get(char)!;
      if (!dayNums.includes(day.dayNumber)) dayNums.push(day.dayNumber);
    }
  }

  // Check idle actor days (actor works day 1 and day 3 but not day 2)
  for (const [actor, dayNums] of actorDays) {
    const sorted = dayNums.slice().sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] > 1) {
        // Find the first day they're on to report it
        const dayId = days.find((d) => d.dayNumber === sorted[0])?.id;
        if (dayId) {
          warnings.push({
            type: "idle_actor",
            severity: "warning",
            message: `${actor} works Day ${sorted[i]} and Day ${sorted[i + 1]} but not Day ${sorted[i] + 1} — idle days cost money.`,
            shootDayId: dayId,
            affectedActors: [actor],
          });
        }
      }
    }
  }

  // Check per-day issues
  for (const day of days) {
    const dayScenes = allScenes.filter((s) => s.shootDayId === day.id);
    if (dayScenes.length === 0) continue;

    // Excessive locations (3+ distinct locations in one day)
    const locations = [...new Set(dayScenes.map((s) => s.location).filter(Boolean))];
    if (locations.length >= 3) {
      warnings.push({
        type: "excessive_locations",
        severity: "warning",
        message: `Day ${day.dayNumber} visits ${locations.length} locations — moving a crew takes hours.`,
        shootDayId: day.id,
        affectedLocations: locations,
      });
    }

    // Page count overrun (> 8 pages/day is considered heavy)
    const totalPages = dayScenes.reduce((sum, s) => sum + (s.durationPages ?? 1), 0);
    if (totalPages > 8) {
      warnings.push({
        type: "page_count_overrun",
        severity: "error",
        message: `Day ${day.dayNumber} has ${totalPages.toFixed(1)} pages scheduled — the day will overrun.`,
        shootDayId: day.id,
      });
    }
  }

  return warnings;
}

// GET /projects/:projectId/shoot-days
router.get("/projects/:projectId/shoot-days", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListShootDaysParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const days = await db
    .select()
    .from(shootDaysTable)
    .where(eq(shootDaysTable.projectId, params.data.projectId))
    .orderBy(asc(shootDaysTable.dayNumber));

  const allScenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.projectId, params.data.projectId));

  const warnings = await computeWarnings(params.data.projectId);

  const result = days.map((day) => {
    const dayScenes = allScenes.filter((s) => s.shootDayId === day.id);
    return {
      ...day,
      scheduledSceneIds: dayScenes.map((s) => s.id),
      scenes: dayScenes,
      warnings: warnings.filter((w) => w.shootDayId === day.id),
    };
  });

  res.json(result);
});

// POST /projects/:projectId/shoot-days
router.post("/projects/:projectId/shoot-days", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CreateShootDayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateShootDayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  // Auto-assign day number
  const existing = await db
    .select()
    .from(shootDaysTable)
    .where(eq(shootDaysTable.projectId, params.data.projectId));
  const dayNumber = existing.length + 1;

  const [day] = await db
    .insert(shootDaysTable)
    .values({
      label: parsed.data.label,
      date: parsed.data.date ? parsed.data.date.toISOString().split("T")[0] : undefined,
      projectId: params.data.projectId,
      dayNumber,
    })
    .returning();

  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "shoot_day_created",
    entityType: "shoot_day",
    entityId: day.id,
    summary: `Created ${day.label}`,
  });

  res.status(201).json({ ...day, scheduledSceneIds: [], scenes: [], warnings: [] });
});

// PATCH /projects/:projectId/shoot-days/:id
router.patch("/projects/:projectId/shoot-days/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateShootDayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateShootDayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [day] = await db
    .update(shootDaysTable)
    .set({
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.date !== undefined ? { date: parsed.data.date.toISOString().split("T")[0] } : {}),
    })
    .where(and(eq(shootDaysTable.id, params.data.id), eq(shootDaysTable.projectId, params.data.projectId)))
    .returning();
  if (!day) {
    res.status(404).json({ error: "Shoot day not found" });
    return;
  }
  const dayScenes = await db.select().from(scenesTable).where(eq(scenesTable.shootDayId, day.id));
  res.json({ ...day, scheduledSceneIds: dayScenes.map((s) => s.id), scenes: dayScenes, warnings: [] });
});

// DELETE /projects/:projectId/shoot-days/:id
router.delete("/projects/:projectId/shoot-days/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteShootDayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  // Verify the shoot day belongs to this project BEFORE modifying any scenes
  const [existing] = await db
    .select({ id: shootDaysTable.id })
    .from(shootDaysTable)
    .where(and(eq(shootDaysTable.id, params.data.id), eq(shootDaysTable.projectId, params.data.projectId)));
  if (!existing) {
    res.status(404).json({ error: "Shoot day not found" });
    return;
  }
  // Unschedule scenes — scoped to both shootDayId AND projectId to prevent cross-project mutations
  await db
    .update(scenesTable)
    .set({ shootDayId: null })
    .where(and(eq(scenesTable.shootDayId, params.data.id), eq(scenesTable.projectId, params.data.projectId)));

  const [day] = await db
    .delete(shootDaysTable)
    .where(and(eq(shootDaysTable.id, params.data.id), eq(shootDaysTable.projectId, params.data.projectId)))
    .returning();
  if (!day) {
    res.status(404).json({ error: "Shoot day not found" });
    return;
  }
  res.sendStatus(204);
});

// PUT /projects/:projectId/shoot-days/:id/schedule
router.put("/projects/:projectId/shoot-days/:id/schedule", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = SetDayScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetDayScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [day] = await db
    .select()
    .from(shootDaysTable)
    .where(and(eq(shootDaysTable.id, params.data.id), eq(shootDaysTable.projectId, params.data.projectId)));
  if (!day) {
    res.status(404).json({ error: "Shoot day not found" });
    return;
  }

  // Clear scenes currently assigned to this day
  await db
    .update(scenesTable)
    .set({ shootDayId: null })
    .where(and(eq(scenesTable.projectId, params.data.projectId), eq(scenesTable.shootDayId, day.id)));

  // Assign new scenes
  if (parsed.data.sceneIds.length > 0) {
    for (const sceneId of parsed.data.sceneIds) {
      await db
        .update(scenesTable)
        .set({ shootDayId: day.id })
        .where(and(eq(scenesTable.id, sceneId), eq(scenesTable.projectId, params.data.projectId)));
    }
  }

  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "schedule_updated",
    entityType: "shoot_day",
    entityId: day.id,
    summary: `Scheduled ${parsed.data.sceneIds.length} scene(s) on ${day.label}`,
  });

  const dayScenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.shootDayId, day.id));

  const warnings = await computeWarnings(params.data.projectId);
  res.json({
    ...day,
    scheduledSceneIds: dayScenes.map((s) => s.id),
    scenes: dayScenes,
    warnings: warnings.filter((w) => w.shootDayId === day.id),
  });
});

// GET /projects/:projectId/shoot-days/:id/call-sheet
router.get("/projects/:projectId/shoot-days/:id/call-sheet", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetCallSheetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [day] = await db
    .select()
    .from(shootDaysTable)
    .where(and(eq(shootDaysTable.id, params.data.id), eq(shootDaysTable.projectId, params.data.projectId)));
  if (!day) {
    res.status(404).json({ error: "Shoot day not found" });
    return;
  }

  const dayScenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.shootDayId, day.id))
    .orderBy(asc(scenesTable.sceneNumber));

  // Collect unique characters across all scenes
  const allCharacters = [...new Set(dayScenes.flatMap((s) => s.characters))].sort();

  // Generate staggered call times (crew 07:00, makeup 07:00, on-set 09:00 baseline)
  const crewCallTime = "07:00";
  const generalCallTime = "07:30";

  const castCalls = allCharacters.map((char, i) => {
    const onSetHour = 9;
    const onSetMinute = 0;
    const makeupOffset = 90; // 90 minutes before on-set
    const callOffset = 120; // 2 hours before on-set
    const stagger = i * 15; // 15-minute stagger between cast

    const callMinutes = onSetHour * 60 + onSetMinute - callOffset + stagger;
    const makeupMinutes = onSetHour * 60 + onSetMinute - makeupOffset + stagger;
    const onSetMinutes = onSetHour * 60 + onSetMinute + stagger;

    const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    return {
      character: char,
      callTime: fmt(callMinutes),
      makeupTime: fmt(makeupMinutes),
      onSetTime: fmt(onSetMinutes),
    };
  });

  await logEvent({
    projectId: params.data.projectId,
    userId,
    actionType: "call_sheet_generated",
    entityType: "shoot_day",
    entityId: day.id,
    summary: `Generated call sheet for ${day.label}`,
  });

  res.json({
    shootDayId: day.id,
    dayNumber: day.dayNumber,
    label: day.label,
    date: day.date ?? null,
    scenes: dayScenes,
    castCalls,
    crewCallTime,
    generalCallTime,
  });
});

// POST /projects/:projectId/shoot-days/:id/ad-review
router.post("/projects/:projectId/shoot-days/:id/ad-review", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = RequestAdReviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!isAiAvailable()) {
    res.status(503).json({ verdict: "", issues: [], coachingNote: "", aiAvailable: false });
    return;
  }

  const [day] = await db
    .select()
    .from(shootDaysTable)
    .where(and(eq(shootDaysTable.id, params.data.id), eq(shootDaysTable.projectId, params.data.projectId)));
  if (!day) {
    res.status(404).json({ error: "Shoot day not found" });
    return;
  }

  const dayScenes = await db
    .select()
    .from(scenesTable)
    .where(eq(scenesTable.shootDayId, day.id));

  const client = getAnthropicClient()!;
  try {
    const callSheetSummary = `
Day: ${day.label}
Scenes: ${dayScenes.map((s) => `Sc.${s.sceneNumber} ${s.intExt}. ${s.location} — ${s.dayNight} (${s.durationPages ?? 1}p) — Cast: ${s.characters.join(", ")}`).join("\n")}
Total pages: ${dayScenes.reduce((sum, s) => sum + (s.durationPages ?? 1), 0).toFixed(1)}
Unique locations: ${[...new Set(dayScenes.map((s) => s.location))].join(", ")}
All cast: ${[...new Set(dayScenes.flatMap((s) => s.characters))].join(", ")}
    `.trim();

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are an experienced First Assistant Director reviewing a student filmmaker's day schedule. Give honest, constructive feedback like a mentor would to a trainee.

Call sheet summary:
${callSheetSummary}

Return a JSON object with:
- verdict (string): one-sentence overall assessment
- issues (array of {description: string, severity: "info"|"warning"|"error"}): specific problems found, most severe first
- coachingNote (string): 2-3 sentences of coaching advice

Return ONLY the JSON object. No markdown.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    let review: { verdict: string; issues: { description: string; severity: string }[]; coachingNote: string };
    try {
      review = JSON.parse(content.text);
    } catch {
      const match = content.text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response");
      review = JSON.parse(match[0]);
    }

    await logEvent({
      projectId: params.data.projectId,
      userId,
      actionType: "ad_review_requested",
      entityType: "shoot_day",
      entityId: day.id,
      summary: `AI AD review requested for ${day.label}`,
    });

    res.json({ ...review, aiAvailable: true });
  } catch (err) {
    logger.error({ err }, "AD review AI call failed");
    res.status(503).json({ verdict: "", issues: [], coachingNote: "", aiAvailable: false });
  }
});

// GET /projects/:projectId/schedule-warnings
router.get("/projects/:projectId/schedule-warnings", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetScheduleWarningsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const owns = await assertProjectOwner(params.data.projectId, userId);
  if (!owns) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const warnings = await computeWarnings(params.data.projectId);
  res.json(warnings);
});

export default router;
