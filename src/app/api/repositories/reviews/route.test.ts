import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { createRepositoryReview, getRepository } = vi.hoisted(() => ({
  createRepositoryReview: vi.fn().mockResolvedValue({
    id: "92eab7d5-8ea9-4204-a464-84a41f0e02fa",
    fullName: "northstar/forge",
    displayName: "Otto",
    kind: "review",
    body: "The topic navigation makes the project much easier to place.",
    createdAt: "2026-08-24T12:00:00Z",
  }),
  getRepository: vi.fn().mockResolvedValue({ fullName: "northstar/forge" }),
}));

vi.mock("@/lib/phlox-data", () => ({ createRepositoryReview }));
vi.mock("@/lib/repository-service", () => ({ getRepository }));

import { POST } from "@/app/api/repositories/reviews/route";

const validBody = {
  fullName: "northstar/forge",
  visitorId: "78cd25c0-79ef-4d09-a153-66f02f83ea11",
  displayName: "Otto",
  kind: "review",
  body: "The topic navigation makes the project much easier to place.",
};

describe("repository review route", () => {
  it("rejects JSON bodies that are not objects", async () => {
    const request = new NextRequest("http://localhost/api/repositories/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null),
    });

    expect((await POST(request)).status).toBe(400);
  });

  it("creates a bounded public review", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/repositories/reviews", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      displayName: "Otto",
      kind: "review",
    });
  });

  it("rejects oversized review text", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/repositories/reviews", {
        method: "POST",
        body: JSON.stringify({ ...validBody, body: "x".repeat(2001) }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects entries for repositories that are not public", async () => {
    getRepository.mockResolvedValueOnce(null);
    const response = await POST(
      new NextRequest("http://localhost/api/repositories/reviews", {
        method: "POST",
        body: JSON.stringify({ ...validBody, fullName: "private/repository" }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
