/**
 * Workflow 5: Create deliverable → move across Kanban columns
 *
 * Covers:
 * - POST /api/projects/:id/deliverables  → deliverable created with status "not_started"
 * - PATCH /api/projects/:id/deliverables/:id  → moved to "in_progress" then "in_review" then "delivered"
 * - GET  /api/projects/:id/deliverables  → full list persists after each move
 * - GET  /api/projects/:id/evidence-log  → deliverable_added and deliverable_moved logged
 *
 * Schema notes (from api-zod):
 *   DeliverableInput:  { title, description?, status?: "not_started"|"in_progress"|"in_review"|"delivered" }
 *   DeliverablePatch:  { title?, description?, status?: same enum }
 */

import { test, expect } from "@playwright/test";

const BASE = "/api";

test.describe("Workflow 5 — Deliverables & Kanban column movement", () => {
  let projectId: number;
  let deliverableId: number;
  let secondDeliverableId: number;

  test("5a. Setup: create project", async ({ request }) => {
    const res = await request.post(`${BASE}/projects`, {
      data: { title: "E2E Short Film — Workflow 5", genre: "Documentary" },
    });
    expect(res.status()).toBe(201);
    projectId = (await res.json()).id;
  });

  test("5b. Create a deliverable — defaults to 'not_started'", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    const res = await request.post(`${BASE}/projects/${projectId}/deliverables`, {
      data: {
        title: "Festival Screener — DCP",
        description: "HDCAM + DCP for festival submission",
        status: "not_started",
      },
    });
    expect(res.status()).toBe(201);
    const d = await res.json();
    expect(d.id).toBeGreaterThan(0);
    expect(d.title).toBe("Festival Screener — DCP");
    expect(d.status).toBe("not_started");
    deliverableId = d.id;
  });

  test("5c. Create a second deliverable for a fuller Kanban board", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    const res = await request.post(`${BASE}/projects/${projectId}/deliverables`, {
      data: {
        title: "Social Media Teaser — 60s",
        description: "Vertical format for Instagram Reels",
        status: "not_started",
      },
    });
    expect(res.status()).toBe(201);
    secondDeliverableId = (await res.json()).id;

    // Both deliverables appear in list
    const listRes = await request.get(`${BASE}/projects/${projectId}/deliverables`);
    const deliverables = await listRes.json();
    expect(deliverables).toHaveLength(2);
    expect(deliverables.every((d: any) => d.status === "not_started")).toBe(true);
  });

  test("5d. Move deliverable from 'not_started' → 'in_progress'", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(deliverableId).toBeGreaterThan(0);

    const res = await request.patch(
      `${BASE}/projects/${projectId}/deliverables/${deliverableId}`,
      { data: { status: "in_progress" } },
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("in_progress");

    // Persist check — second deliverable is untouched
    const listRes = await request.get(`${BASE}/projects/${projectId}/deliverables`);
    const deliverables = await listRes.json();
    const dcp = deliverables.find((d: any) => d.id === deliverableId);
    const teaser = deliverables.find((d: any) => d.id === secondDeliverableId);
    expect(dcp.status).toBe("in_progress");
    expect(teaser.status).toBe("not_started");
  });

  test("5e. Move deliverable from 'in_progress' → 'in_review'", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(deliverableId).toBeGreaterThan(0);

    const res = await request.patch(
      `${BASE}/projects/${projectId}/deliverables/${deliverableId}`,
      { data: { status: "in_review" } },
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("in_review");
  });

  test("5f. Move deliverable from 'in_review' → 'delivered'", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(deliverableId).toBeGreaterThan(0);

    const res = await request.patch(
      `${BASE}/projects/${projectId}/deliverables/${deliverableId}`,
      { data: { status: "delivered" } },
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("delivered");

    // Final persist check — simulate returning to board after page navigation
    const listRes = await request.get(`${BASE}/projects/${projectId}/deliverables`);
    const deliverables = await listRes.json();
    const dcp = deliverables.find((d: any) => d.id === deliverableId);
    expect(dcp.status).toBe("delivered");
  });

  test("5g. Evidence log has deliverable_added and deliverable_moved entries", async ({ request }) => {
    const res = await request.get(`${BASE}/projects/${projectId}/evidence-log`);
    expect(res.status()).toBe(200);
    const { entries } = await res.json();
    const actionTypes = entries.map((e: any) => e.actionType);
    expect(actionTypes).toContain("deliverable_added");
    expect(actionTypes).toContain("deliverable_moved");

    // Three column moves → at least three deliverable_moved entries
    const movedEntries = entries.filter((e: any) => e.actionType === "deliverable_moved");
    expect(movedEntries.length).toBeGreaterThanOrEqual(3);

    const summaries: string[] = movedEntries.map((e: any) => e.summary);
    expect(summaries.some((s) => s.includes("in_progress"))).toBe(true);
    expect(summaries.some((s) => s.includes("in_review"))).toBe(true);
    expect(summaries.some((s) => s.includes("delivered"))).toBe(true);
  });

  test("5h. Clean up", async ({ request }) => {
    if (!projectId) return;
    await request.delete(`${BASE}/projects/${projectId}`);
  });
});
