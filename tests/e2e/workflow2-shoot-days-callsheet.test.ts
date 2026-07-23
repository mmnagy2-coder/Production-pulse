/**
 * Workflow 2: Create shoot days → drag scenes onto days → generate call sheet
 *
 * Covers:
 * - POST /api/projects/:id/shoot-days  → shoot day created
 * - PUT  /api/projects/:id/shoot-days/:dayId/schedule  → scenes assigned (drag-drop equivalent)
 * - GET  /api/projects/:id/shoot-days  → schedule persists on re-fetch
 * - GET  /api/projects/:id/shoot-days/:dayId/call-sheet  → call sheet generated with cast calls
 * - GET  /api/projects/:id/evidence-log  → shoot_day_created, schedule_updated, call_sheet_generated logged
 */

import { test, expect } from "@playwright/test";

const BASE = "/api";

test.describe("Workflow 2 — Shoot days, scheduling & call sheet", () => {
  let projectId: number;
  let sceneIds: number[] = [];
  let dayId: number;

  test("2a. Setup: create project and scenes", async ({ request }) => {
    const proj = await request.post(`${BASE}/projects`, {
      data: { title: "E2E Short Film — Workflow 2", genre: "Thriller" },
    });
    expect(proj.status()).toBe(201);
    projectId = (await proj.json()).id;

    const scene1 = await request.post(`${BASE}/projects/${projectId}/scenes`, {
      data: {
        sceneNumber: 1,
        heading: "INT. OFFICE - DAY",
        intExt: "INT",
        dayNight: "DAY",
        location: "OFFICE",
        durationPages: 2,
        summary: "Detective interrogates a suspect.",
        characters: ["DETECTIVE", "SUSPECT"],
        props: ["desk", "lamp"],
        costumes: [],
      },
    });
    expect(scene1.status()).toBe(201);
    sceneIds.push((await scene1.json()).id);

    const scene2 = await request.post(`${BASE}/projects/${projectId}/scenes`, {
      data: {
        sceneNumber: 2,
        heading: "EXT. PARKING LOT - NIGHT",
        intExt: "EXT",
        dayNight: "NIGHT",
        location: "PARKING LOT",
        durationPages: 1.5,
        summary: "Suspect escapes into the dark.",
        characters: ["SUSPECT"],
        props: ["car keys"],
        costumes: [],
      },
    });
    expect(scene2.status()).toBe(201);
    sceneIds.push((await scene2.json()).id);
  });

  test("2b. Create a shoot day and verify it persists", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    const res = await request.post(`${BASE}/projects/${projectId}/shoot-days`, {
      data: { label: "Day 1 — Office Block", date: "2026-09-15" },
    });
    expect(res.status()).toBe(201);
    const day = await res.json();
    expect(day.id).toBeGreaterThan(0);
    expect(day.label).toBe("Day 1 — Office Block");
    expect(day.dayNumber).toBe(1);
    dayId = day.id;

    // Re-fetch shoot days (simulates navigating away and back)
    const listRes = await request.get(`${BASE}/projects/${projectId}/shoot-days`);
    expect(listRes.status()).toBe(200);
    const days = await listRes.json();
    expect(days).toHaveLength(1);
    expect(days[0].id).toBe(dayId);
  });

  test("2c. Schedule scenes onto the shoot day (drag-drop equivalent)", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(dayId).toBeGreaterThan(0);
    expect(sceneIds).toHaveLength(2);

    const res = await request.put(
      `${BASE}/projects/${projectId}/shoot-days/${dayId}/schedule`,
      { data: { sceneIds } },
    );
    expect(res.status()).toBe(200);
    const updated = await res.json();
    expect(updated.scheduledSceneIds).toHaveLength(2);
    expect(updated.scenes).toHaveLength(2);
    expect(updated.scheduledSceneIds).toEqual(expect.arrayContaining(sceneIds));

    // Persist check: re-fetch shoot days
    const listRes = await request.get(`${BASE}/projects/${projectId}/shoot-days`);
    const days = await listRes.json();
    expect(days[0].scheduledSceneIds).toHaveLength(2);
  });

  test("2d. Generate call sheet — returns scenes, cast calls, and crew times", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(dayId).toBeGreaterThan(0);

    const res = await request.get(
      `${BASE}/projects/${projectId}/shoot-days/${dayId}/call-sheet`,
    );
    expect(res.status()).toBe(200);
    const sheet = await res.json();

    expect(sheet.shootDayId).toBe(dayId);
    expect(sheet.label).toBe("Day 1 — Office Block");
    expect(Array.isArray(sheet.scenes)).toBe(true);
    expect(sheet.scenes).toHaveLength(2);

    // Cast calls must include each unique character
    expect(Array.isArray(sheet.castCalls)).toBe(true);
    const characters = sheet.castCalls.map((c: any) => c.character);
    expect(characters).toContain("DETECTIVE");
    expect(characters).toContain("SUSPECT");

    // Each cast call must have time fields
    for (const call of sheet.castCalls) {
      expect(call).toHaveProperty("callTime");
      expect(call).toHaveProperty("makeupTime");
      expect(call).toHaveProperty("onSetTime");
      expect(call.callTime).toMatch(/^\d{2}:\d{2}$/);
    }

    expect(sheet.crewCallTime).toMatch(/^\d{2}:\d{2}$/);
  });

  test("2e. Evidence log has shoot_day_created, schedule_updated, call_sheet_generated", async ({ request }) => {
    const res = await request.get(`${BASE}/projects/${projectId}/evidence-log`);
    expect(res.status()).toBe(200);
    const { entries } = await res.json();
    const actionTypes = entries.map((e: any) => e.actionType);
    expect(actionTypes).toContain("shoot_day_created");
    expect(actionTypes).toContain("schedule_updated");
    expect(actionTypes).toContain("call_sheet_generated");
  });

  test("2f. Clean up", async ({ request }) => {
    if (!projectId) return;
    await request.delete(`${BASE}/projects/${projectId}`);
  });
});
