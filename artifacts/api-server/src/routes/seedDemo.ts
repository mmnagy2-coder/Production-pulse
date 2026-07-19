import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  projectsTable,
  scenesTable,
  shootDaysTable,
  takesTable,
  reviewCutsTable,
  cutCommentsTable,
  deliverablesTable,
} from "@workspace/db";
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

  // Only seed if the user has no projects at all
  const existing = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    res.json({ alreadySeeded: true });
    return;
  }

  // ── Project ──────────────────────────────────────────────────────────────
  const [project] = await db
    .insert(projectsTable)
    .values({
      userId,
      title: "Echo Chamber",
      logline:
        "A sound engineer discovers that the apartment above hers is occupied by the ghost of her estranged mother — and the only way to reach her is through the mixing board.",
      genre: "Drama / Supernatural",
      currentStage: "post_production",
      scriptText: `ECHO CHAMBER
Written by Mostafa Nagy

FADE IN:

INT. RECORDING STUDIO — NIGHT

MAYA HASSAN (30s, headphones around her neck) sits alone at a massive mixing console. Twelve tracks, all flat. She reaches for a dial.

A sound — barely there — bleeds through the monitors. A voice. She leans in.

MAYA
(to herself)
That's not on the session.

INT. APARTMENT STAIRWELL — NIGHT

Maya climbs the worn staircase to the fourth floor. Her phone torch picks out peeling paint, a child's drawing still taped to the wall.

She stops outside apartment 4B. A sliver of light under the door.

INT. APARTMENT 4B — NIGHT

Empty. Completely. Except for a scatter of old photographs face-down on the bare floorboards.

Maya picks one up. She looks at it for a long time.

EXT. CITY STREET — DAY

Maya at a payphone — a relic, somehow still working. She dials. It rings. And rings.

MAYA
Kareem, it's me. Call me back when you get this. It's about Mum.

INT. RECORDING STUDIO — DAY

Maya plays back the night session at full volume. The twelve flat tracks — one of them isn't flat anymore. Buried in the noise floor: a voice, unmistakably her mother's.

MAYA (V.O.)
(whispering)
She's been here the whole time.

INT. APARTMENT 4B — DUSK

Maya sits cross-legged on the floorboards, photographs arranged around her. She presses record on her phone.

MAYA
I don't know if you can hear this. But I'm listening now.

A long silence. Then — from somewhere deep in the walls — a sound like fingers on glass.

FADE OUT.
`,
    })
    .returning();

  const projectId = project.id;

  // ── Shoot days ───────────────────────────────────────────────────────────
  const [dayLocation, dayStudioNight, dayApartment] = await db
    .insert(shootDaysTable)
    .values([
      { projectId, dayNumber: 1, label: "Location Day", date: "2026-09-08" },
      { projectId, dayNumber: 2, label: "Studio Night", date: "2026-09-09" },
      { projectId, dayNumber: 3, label: "Apartment Days", date: "2026-09-10" },
    ])
    .returning();

  // ── Scenes ───────────────────────────────────────────────────────────────
  const [s1, s2, s3, s4, s5, s6] = await db
    .insert(scenesTable)
    .values([
      {
        projectId,
        sceneNumber: 1,
        heading: "INT. RECORDING STUDIO — NIGHT",
        intExt: "INT",
        dayNight: "NIGHT",
        location: "Recording Studio",
        durationPages: 1.5,
        summary:
          "Maya works alone at the console late at night and hears an unaccounted-for voice through the monitors.",
        characters: ["MAYA"],
        props: ["Mixing console", "Headphones", "Coffee cup"],
        costumes: ["Maya — casual studio wear"],
        shootDayId: dayStudioNight.id,
        aiGenerated: true,
        corrected: true,
      },
      {
        projectId,
        sceneNumber: 2,
        heading: "INT. APARTMENT STAIRWELL — NIGHT",
        intExt: "INT",
        dayNight: "NIGHT",
        location: "Apartment Building",
        durationPages: 0.75,
        summary: "Maya climbs to the fourth floor following the mysterious sound.",
        characters: ["MAYA"],
        props: ["Phone (torch)", "Child's drawing"],
        costumes: ["Maya — same as Sc.1"],
        shootDayId: dayApartment.id,
        aiGenerated: true,
        corrected: true,
      },
      {
        projectId,
        sceneNumber: 3,
        heading: "INT. APARTMENT 4B — NIGHT",
        intExt: "INT",
        dayNight: "NIGHT",
        location: "Apartment 4B",
        durationPages: 1.0,
        summary:
          "The apartment is completely empty except for old photographs scattered face-down on the floor.",
        characters: ["MAYA"],
        props: ["Old photographs (x12)", "Phone torch"],
        costumes: ["Maya — same as Sc.1"],
        shootDayId: dayApartment.id,
        aiGenerated: true,
        corrected: true,
      },
      {
        projectId,
        sceneNumber: 4,
        heading: "EXT. CITY STREET — DAY",
        intExt: "EXT",
        dayNight: "DAY",
        location: "City Street — Payphone",
        durationPages: 0.5,
        summary: "Maya calls her brother Kareem from a working payphone.",
        characters: ["MAYA"],
        props: ["Payphone", "Coin"],
        costumes: ["Maya — day jacket"],
        shootDayId: dayLocation.id,
        aiGenerated: true,
        corrected: false,
      },
      {
        projectId,
        sceneNumber: 5,
        heading: "INT. RECORDING STUDIO — DAY",
        intExt: "INT",
        dayNight: "DAY",
        location: "Recording Studio",
        durationPages: 1.25,
        summary:
          "Playback of the night session reveals her mother's voice buried in the noise floor of one track.",
        characters: ["MAYA"],
        props: ["Mixing console", "Headphones", "Printed session sheets"],
        costumes: ["Maya — day jacket"],
        shootDayId: dayStudioNight.id,
        aiGenerated: true,
        corrected: true,
      },
      {
        projectId,
        sceneNumber: 6,
        heading: "INT. APARTMENT 4B — DUSK",
        intExt: "INT",
        dayNight: "DUSK",
        location: "Apartment 4B",
        durationPages: 1.0,
        summary:
          "Maya sits among the photographs and speaks aloud to the room, recording herself on her phone.",
        characters: ["MAYA"],
        props: ["Old photographs (x12)", "Phone (recording)"],
        costumes: ["Maya — day jacket"],
        shootDayId: dayApartment.id,
        aiGenerated: true,
        corrected: false,
      },
    ])
    .returning();

  // ── Takes ─────────────────────────────────────────────────────────────────
  await db.insert(takesTable).values([
    // Scene 1 — Studio Night
    {
      projectId,
      sceneId: s1.id,
      shootDayId: dayStudioNight.id,
      sceneNumber: 1,
      shotLabel: "A1",
      takeNumber: 1,
      circled: false,
      notes: "Good energy but slight focus pull at monitor.",
    },
    {
      projectId,
      sceneId: s1.id,
      shootDayId: dayStudioNight.id,
      sceneNumber: 1,
      shotLabel: "A1",
      takeNumber: 2,
      circled: false,
      notes: "Camera movement slightly early.",
    },
    {
      projectId,
      sceneId: s1.id,
      shootDayId: dayStudioNight.id,
      sceneNumber: 1,
      shotLabel: "A1",
      takeNumber: 3,
      circled: true,
      notes: "Perfect. Maya's reaction is exactly right.",
    },
    // Scene 2 — Stairwell
    {
      projectId,
      sceneId: s2.id,
      shootDayId: dayApartment.id,
      sceneNumber: 2,
      shotLabel: "A1",
      takeNumber: 1,
      circled: false,
      notes: "Torch flare on step 7.",
    },
    {
      projectId,
      sceneId: s2.id,
      shootDayId: dayApartment.id,
      sceneNumber: 2,
      shotLabel: "A1",
      takeNumber: 2,
      circled: true,
      notes: "Clean. Good pace.",
    },
    // Scene 4 — Payphone
    {
      projectId,
      sceneId: s4.id,
      shootDayId: dayLocation.id,
      sceneNumber: 4,
      shotLabel: "A1",
      takeNumber: 1,
      circled: true,
      notes: "Delivery is understated — exactly what we need.",
    },
    {
      projectId,
      sceneId: s4.id,
      shootDayId: dayLocation.id,
      sceneNumber: 4,
      shotLabel: "A1",
      takeNumber: 2,
      circled: false,
      notes: "Too much emotion. Keep Take 1.",
    },
    // Scene 5 — Studio Day
    {
      projectId,
      sceneId: s5.id,
      shootDayId: dayStudioNight.id,
      sceneNumber: 5,
      shotLabel: "A1",
      takeNumber: 1,
      circled: false,
      notes: "Line fluffed on V.O.",
    },
    {
      projectId,
      sceneId: s5.id,
      shootDayId: dayStudioNight.id,
      sceneNumber: 5,
      shotLabel: "A1",
      takeNumber: 2,
      circled: true,
      notes: "Clean V.O. and great monitor performance.",
    },
    {
      projectId,
      sceneId: s5.id,
      shootDayId: dayStudioNight.id,
      sceneNumber: 5,
      shotLabel: "B1",
      takeNumber: 1,
      circled: true,
      notes: "Insert close-up of session sheet. Perfect.",
    },
  ]);

  // ── Review cuts ───────────────────────────────────────────────────────────
  const [cutAssembly, cutFine] = await db
    .insert(reviewCutsTable)
    .values([
      {
        projectId,
        title: "Assembly Cut — v1",
        status: "approved",
        notes:
          "All circled takes strung together in script order. Approved for fine cut.",
      },
      {
        projectId,
        title: "Fine Cut — v3",
        status: "pending",
        notes:
          "Scene 3 extended by 8 frames to let the photograph reaction breathe. Audio temp mix applied.",
      },
    ])
    .returning();

  // Cut comments on the assembly cut
  await db.insert(cutCommentsTable).values([
    {
      cutId: cutAssembly.id,
      text: "The transition from Sc.2 to Sc.3 is too abrupt — hold on Maya's face longer.",
      xPercent: 42.5,
      yPercent: 68.0,
      pinNumber: 1,
    },
    {
      cutId: cutAssembly.id,
      text: "Excellent. This beat lands perfectly.",
      xPercent: 78.0,
      yPercent: 35.0,
      pinNumber: 2,
    },
    {
      cutId: cutFine.id,
      text: "The extended pause in Sc.3 works. Don't cut it down.",
      xPercent: 55.0,
      yPercent: 50.0,
      pinNumber: 1,
    },
  ]);

  // ── Deliverables ─────────────────────────────────────────────────────────
  await db.insert(deliverablesTable).values([
    {
      projectId,
      title: "DCP Master (2K Flat)",
      description: "Digital Cinema Package for theatrical exhibition. Requires DCP-o-matic encode.",
      status: "in_progress",
    },
    {
      projectId,
      title: "Festival EPK",
      description:
        "Electronic press kit: director's statement, stills, poster, synopsis (50 & 100 words).",
      status: "delivered",
    },
    {
      projectId,
      title: "Theatrical Trailer (2:00)",
      description: "Cut by editor from Fine Cut v3. Music TBC with composer.",
      status: "not_started",
    },
    {
      projectId,
      title: "Colour Grade Reference Export",
      description: "Offline ProRes export with baked-in grade for streaming delivery.",
      status: "in_review",
    },
  ]);

  res.status(201).json({ seeded: true, projectId });
});

export default router;
