import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/repositories/reactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const { getRepository, setRepositoryReaction } = vi.hoisted(() => ({
  getRepository: vi.fn().mockResolvedValue({ fullName: "northstar/forge" }),
  setRepositoryReaction: vi.fn().mockResolvedValue({
    likes: 19,
    dislikes: 3,
    reaction: "like",
  }),
}));

vi.mock("@/lib/phlox-data", () => ({ setRepositoryReaction }));
vi.mock("@/lib/repository-service", () => ({ getRepository }));

import { POST } from "@/app/api/repositories/reactions/route";

describe("repository reaction route", () => {
  it("persists a validated anonymous reaction", async () => {
    const request = new NextRequest(
      "http://localhost/api/repositories/reactions",
      {
        method: "POST",
        body: JSON.stringify({
          fullName: "northstar/forge",
          visitorId: "78cd25c0-79ef-4d09-a153-66f02f83ea11",
          reaction: "like",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      likes: 19,
      dislikes: 3,
      reaction: "like",
    });
  });

  it("rejects malformed reaction payloads", async () => {
    const request = new NextRequest(
      "http://localhost/api/repositories/reactions",
      {
        method: "POST",
        body: JSON.stringify({
          fullName: "not-a-repository",
          visitorId: "not-a-uuid",
          reaction: "love",
        }),
      },
    );

    expect((await POST(request)).status).toBe(400);
  });

  it("rejects reactions for repositories that are not public", async () => {
    getRepository.mockResolvedValueOnce(null);
    const request = new NextRequest(
      "http://localhost/api/repositories/reactions",
      {
        method: "POST",
        body: JSON.stringify({
          fullName: "private/repository",
          visitorId: "78cd25c0-79ef-4d09-a153-66f02f83ea11",
          reaction: "like",
        }),
      },
    );

    expect((await POST(request)).status).toBe(404);
  });

  it("rejects JSON bodies that are not objects", async () => {
    expect((await POST(jsonRequest(null))).status).toBe(400);
    expect((await POST(jsonRequest("like"))).status).toBe(400);
  });
});