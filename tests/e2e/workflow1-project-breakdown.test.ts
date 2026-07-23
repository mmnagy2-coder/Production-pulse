/**
 * Workflow 1: Create project → AI breakdown → accept scenes
 *
 * Covers:
 * - POST /api/projects  → project created, persists on re-fetch
 * - POST /api/projects/:id/breakdown  → graceful response (AI may be unavailable)
 * - POST /api/projects/:id/breakdown/accept  → scenes saved to DB
 * - GET  /api/projects/:id/scenes  → scenes visible after navigation (data persistence)
 * - GET  /api/projects/:id/evidence-log  → audit entries recorded for each mutation
 */

import { test, expect } from "@playwright/test";

const BASE = "/api";
const USER = "test-student-user-1";

test.describe("Workflow 1 — Project creation, breakdown & scene acceptance", () => {
  let projectId: number;

  test("1a. Create a project and verify it persists on re-fetch", async ({ request }) => {
    const res = await request.post(`${BASE}/projects`, {
      data: { title: "E2E Short Film — Workflow 1", genre: "Drama" },
    });
    expect(res.status()).toBe(201);
    const project = await res.json();
    expect(project.id).toBeGreaterThan(0);
    expect(project.title).toBe("E2E Short Film — Workflow 1");
    expect(project.userId).toBe(USER);
    projectId = project.id;

    // Simulate navigating away and back — fetch project fresh
    const refetch = await request.get(`${BASE}/projects/${projectId}`);
    expect(refetch.status()).toBe(200);
    const same = await refetch.json();
    expect(same.id).toBe(projectId);
    expect(same.title).toBe("E2E Short Film — Workflow 1");
  });

  test("1b. Run AI breakdown — response is valid regardless of AI availability", async ({ request }) => {
    expect(projectId, "Project must exist from previous test").toBeGreaterThan(0);

    const screenplay = `
INT. KITCHEN - DAY
ALICE pours coffee. She notices a note on the counter.

EXT. GARDEN - DAY
BOB waters flowers. ALICE walks out to meet him.

INT. LIVING ROOM - NIGHT
ALICE and BOB argue. CAROL watches from the doorway.
    `.trim();

    const res = await request.post(`${BASE}/projects/${projectId}/breakdown`, {
      data: { scriptText: screenplay },
    });

    // 200 with scenes (AI available) or 503/200 with aiAvailable:false (AI down)
    const body = await res.json();
    expect(body).toHaveProperty("scenes");
    expect(Array.isArray(body.scenes)).toBe(true);
    expect(body).toHaveProperty("aiAvailable");
    // Either we got real scenes or a graceful empty result — both are correct
    if (body.aiAvailable) {
      expect(body.scenes.length).toBeGreaterThan(0);
    }
  });

  test("1c. Accept breakdown scenes — scenes saved and visible on re-fetch", async ({ request }) => {
    expect(projectId, "Project must exist from previous test").toBeGreaterThan(0);

    const scenesToAccept = [
      {
        sceneNumber: 1,
        heading: "INT. KITCHEN - DAY",
        intExt: "INT",
        dayNight: "DAY",
        location: "KITCHEN",
        durationPages: 1,
        summary: "Alice pours coffee and finds a mysterious note.",
        characters: ["ALICE"],
        props: ["coffee mug", "note"],
        costumes: [],
      },
      {
        sceneNumber: 2,
        heading: "EXT. GARDEN - DAY",
        intExt: "EXT",
        dayNight: "DAY",
        location: "GARDEN",
        durationPages: 1.5,
        summary: "Alice meets Bob in the garden.",
        characters: ["ALICE", "BOB"],
        props: ["watering can"],
        costumes: [],
      },
      {
        sceneNumber: 3,
        heading: "INT. LIVING ROOM - NIGHT",
        intExt: "INT",
        dayNight: "NIGHT",
        location: "LIVING ROOM",
        durationPages: 2,
        summary: "Alice and Bob argue while Carol watches.",
        characters: ["ALICE", "BOB", "CAROL"],
        props: [],
        costumes: [],
      },
    ];

    const res = await request.post(`${BASE}/projects/${projectId}/breakdown/accept`, {
      data: { scenes: scenesToAccept },
    });
    expect(res.status()).toBe(201);
    const saved = await res.json();
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).toHaveLength(3);
    expect(saved[0].aiGenerated).toBe(true);
    expect(saved[0].projectId).toBe(projectId);

    // Simulate navigating to the scenes page — data must persist
    const listRes = await request.get(`${BASE}/projects/${projectId}/scenes`);
    expect(listRes.status()).toBe(200);
    const scenes = await listRes.json();
    expect(scenes).toHaveLength(3);
    expect(scenes.map((s: any) => s.sceneNumber)).toEqual([1, 2, 3]);
  });

  test("1d. Evidence log records project_created and breakdown_accepted entries", async ({ request }) => {
    expect(projectId, "Project must exist from previous test").toBeGreaterThan(0);

    const res = await request.get(`${BASE}/projects/${projectId}/evidence-log`);
    expect(res.status()).toBe(200);
    const { entries } = await res.json();
    expect(Array.isArray(entries)).toBe(true);

    const actionTypes = entries.map((e: any) => e.actionType);
    expect(actionTypes).toContain("project_created");
    expect(actionTypes).toContain("breakdown_accepted");
  });

  test("1e. Clean up — delete project", async ({ request }) => {
    if (!projectId) return;
    const res = await request.delete(`${BASE}/projects/${projectId}`);
    expect(res.status()).toBe(204);
  });
});
