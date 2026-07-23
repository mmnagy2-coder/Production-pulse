/**
 * Workflow 4: Create cut → pin frame comment → approve cut
 *
 * Covers:
 * - POST /api/projects/:id/cuts  → cut created with status "pending"
 * - POST /api/projects/:id/cuts/:cutId/comments  → pinned comment at coordinates
 * - GET  /api/projects/:id/cuts/:cutId/comments  → comments persist on re-fetch
 * - PATCH /api/projects/:id/cuts/:cutId  → status changed to "approved"
 * - GET  /api/projects/:id/cuts  → approved cut visible in list
 * - GET  /api/projects/:id/evidence-log  → review_comment_added, cut_status_changed present
 *
 * Schema notes (from api-zod):
 *   ReviewCutInput: { title, imageUrl?, notes? }
 *   ReviewCutPatch: { title?, imageUrl?, status?: "pending"|"changes_needed"|"approved", notes? }
 *   CutCommentInput: { text, xPercent, yPercent }
 */

import { test, expect } from "@playwright/test";

const BASE = "/api";

test.describe("Workflow 4 — Review cuts, frame comments & approval", () => {
  let projectId: number;
  let cutId: number;

  test("4a. Setup: create project", async ({ request }) => {
    const res = await request.post(`${BASE}/projects`, {
      data: { title: "E2E Short Film — Workflow 4", genre: "Sci-Fi" },
    });
    expect(res.status()).toBe(201);
    projectId = (await res.json()).id;
  });

  test("4b. Create a cut (starts as 'pending')", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);

    const res = await request.post(`${BASE}/projects/${projectId}/cuts`, {
      data: {
        title: "Assembly Cut v1",
        imageUrl: "https://example.com/frames/cut1.jpg",
        notes: "First pass — needs colour grade",
      },
    });
    expect(res.status()).toBe(201);
    const cut = await res.json();
    expect(cut.id).toBeGreaterThan(0);
    expect(cut.title).toBe("Assembly Cut v1");
    expect(cut.status).toBe("pending");
    expect(cut.commentCount).toBe(0);
    cutId = cut.id;

    // Persist check
    const listRes = await request.get(`${BASE}/projects/${projectId}/cuts`);
    expect(listRes.status()).toBe(200);
    const cuts = await listRes.json();
    expect(cuts).toHaveLength(1);
    expect(cuts[0].id).toBe(cutId);
  });

  test("4c. Pin a frame comment at specific coordinates", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(cutId).toBeGreaterThan(0);

    const res = await request.post(
      `${BASE}/projects/${projectId}/cuts/${cutId}/comments`,
      {
        data: {
          text: "Horizon line is crooked here — fix in DaVinci",
          xPercent: 45.5,
          yPercent: 52.3,
        },
      },
    );
    expect(res.status()).toBe(201);
    const comment = await res.json();
    expect(comment.id).toBeGreaterThan(0);
    expect(comment.text).toBe("Horizon line is crooked here — fix in DaVinci");
    expect(comment.xPercent).toBeCloseTo(45.5);
    expect(comment.yPercent).toBeCloseTo(52.3);
    expect(comment.pinNumber).toBe(1);
  });

  test("4d. Add a second comment — pin numbers increment correctly", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(cutId).toBeGreaterThan(0);

    const res = await request.post(
      `${BASE}/projects/${projectId}/cuts/${cutId}/comments`,
      {
        data: {
          text: "Sound sync is off from 01:02 — audio drop",
          xPercent: 10.0,
          yPercent: 90.0,
        },
      },
    );
    expect(res.status()).toBe(201);
    const comment2 = await res.json();
    expect(comment2.pinNumber).toBe(2);
  });

  test("4e. Comments persist on re-fetch (simulates page reload)", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(cutId).toBeGreaterThan(0);

    const res = await request.get(
      `${BASE}/projects/${projectId}/cuts/${cutId}/comments`,
    );
    expect(res.status()).toBe(200);
    const comments = await res.json();
    expect(comments).toHaveLength(2);
    expect(comments[0].pinNumber).toBe(1);
    expect(comments[1].pinNumber).toBe(2);
  });

  test("4f. Mark cut as 'changes_needed' then approve it", async ({ request }) => {
    expect(projectId).toBeGreaterThan(0);
    expect(cutId).toBeGreaterThan(0);

    // First: request changes
    const changesRes = await request.patch(
      `${BASE}/projects/${projectId}/cuts/${cutId}`,
      { data: { status: "changes_needed" } },
    );
    expect(changesRes.status()).toBe(200);
    expect((await changesRes.json()).status).toBe("changes_needed");

    // Then: approve
    const approveRes = await request.patch(
      `${BASE}/projects/${projectId}/cuts/${cutId}`,
      { data: { status: "approved" } },
    );
    expect(approveRes.status()).toBe(200);
    const approved = await approveRes.json();
    expect(approved.status).toBe("approved");
    expect(approved.commentCount).toBe(2); // comments still there

    // Persist check: re-fetch list
    const listRes = await request.get(`${BASE}/projects/${projectId}/cuts`);
    const cuts = await listRes.json();
    expect(cuts[0].status).toBe("approved");
  });

  test("4g. Evidence log has review_comment_added and cut_status_changed", async ({ request }) => {
    const res = await request.get(`${BASE}/projects/${projectId}/evidence-log`);
    expect(res.status()).toBe(200);
    const { entries } = await res.json();
    const actionTypes = entries.map((e: any) => e.actionType);
    expect(actionTypes).toContain("review_comment_added");
    expect(actionTypes).toContain("cut_status_changed");

    // Two status transitions → two cut_status_changed entries
    const statusChanges = entries.filter((e: any) => e.actionType === "cut_status_changed");
    expect(statusChanges.length).toBeGreaterThanOrEqual(2);
  });

  test("4h. Clean up", async ({ request }) => {
    if (!projectId) return;
    await request.delete(`${BASE}/projects/${projectId}`);
  });
});
