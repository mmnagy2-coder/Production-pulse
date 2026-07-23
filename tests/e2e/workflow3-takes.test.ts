/**
 * Workflow 3: Log takes → circle takes
 *
 * Covers:
 * - POST /api/projects/:id/takes  → take logged
 * - PATCH /api/projects/:id/takes/:takeId  → take circled (status toggled)
 * - GET  /api/projects/:id/takes  → full take list persists
 * - GET  /api/projects/:id/takes/circled  → circled-only list
 * - GET  /api/projects/:id/evidence-log  → take_logged and take_circled entries present
 */

import { test, expect } from "@playwright/test";

const BASE = "/api";

test.describe("Workflow 3 — Take logging & circling", () => {
  let projectId: number;
  let take1Id: number;
  let take2Id: number;
  let take3Id: number;

  test("3a. Setup: create project", async ({ request }) => {
    const res = await request.post(`${BASE}/projects`, {
      data: { title: "E2E Short Film — Workflow 3", genre: "Comedy" },
    });
    expect(res.status()).toBe(201);
    projectId = (await res.json()).id;
  });

  test("3b. Log three takes for the same shot", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    const base = {
      sceneNumber: 1,
      shotLabel: "1A",
    };

    const t1 = await request.post(`${BASE}/projects/${projectId}/takes`, {
      data: { ...base, takeNumber: 1, notes: "Camera shake — NG", circled: false },
    });
    expect(t1.status()).toBe(201);
    const take1 = await t1.json();
    expect(take1.sceneNumber).toBe(1);
    expect(take1.shotLabel).toBe("1A");
    expect(take1.takeNumber).toBe(1);
    expect(take1.circled).toBe(false);
    take1Id = take1.id;

    const t2 = await request.post(`${BASE}/projects/${projectId}/takes`, {
      data: { ...base, takeNumber: 2, notes: "Good energy but line flub", circled: false },
    });
    expect(t2.status()).toBe(201);
    take2Id = (await t2.json()).id;

    const t3 = await request.post(`${BASE}/projects/${projectId}/takes`, {
      data: { ...base, takeNumber: 3, notes: "Best performance", circled: false },
    });
    expect(t3.status()).toBe(201);
    take3Id = (await t3.json()).id;

    // Persist check: re-fetch all takes
    const listRes = await request.get(`${BASE}/projects/${projectId}/takes`);
    expect(listRes.status()).toBe(200);
    const takes = await listRes.json();
    expect(takes).toHaveLength(3);
  });

  test("3c. Circle the best take", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(take3Id).toBeGreaterThan(0);

    const res = await request.patch(
      `${BASE}/projects/${projectId}/takes/${take3Id}`,
      { data: { circled: true } },
    );
    expect(res.status()).toBe(200);
    const updated = await res.json();
    expect(updated.id).toBe(take3Id);
    expect(updated.circled).toBe(true);
  });

  test("3d. Circled-takes list shows exactly one entry", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    const res = await request.get(`${BASE}/projects/${projectId}/takes/circled`);
    expect(res.status()).toBe(200);
    const circled = await res.json();
    expect(circled).toHaveLength(1);
    expect(circled[0].id).toBe(take3Id);
    expect(circled[0].circled).toBe(true);
  });

  test("3e. Uncircle — take removed from circled list", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    await request.patch(`${BASE}/projects/${projectId}/takes/${take3Id}`, {
      data: { circled: false },
    });

    const res = await request.get(`${BASE}/projects/${projectId}/takes/circled`);
    const circled = await res.json();
    expect(circled).toHaveLength(0);

    // Re-circle to leave test data meaningful
    await request.patch(`${BASE}/projects/${projectId}/takes/${take3Id}`, {
      data: { circled: true },
    });
  });

  test("3f. Evidence log has take_logged and take_circled entries", async ({ request }) => {
    const res = await request.get(`${BASE}/projects/${projectId}/evidence-log`);
    expect(res.status()).toBe(200);
    const { entries } = await res.json();
    const actionTypes = entries.map((e: any) => e.actionType);
    expect(actionTypes).toContain("take_logged");
    expect(actionTypes).toContain("take_circled");
    // take_uncircled should also appear since we toggled it
    expect(actionTypes).toContain("take_uncircled");
  });

  test("3g. Clean up", async ({ request }) => {
    if (!projectId) return;
    await request.delete(`${BASE}/projects/${projectId}`);
  });
});
