import { describe, expect, it, vi } from "vitest";

import { parseSocialImage, resolveRepositoryVisual } from "@/lib/repository-visual";

describe("repository visuals", () => {
  it("prefers a README screenshot", async () => {
    const visual = await resolveRepositoryVisual("a", "b", {
      readme: vi.fn().mockResolvedValue({
        content: "",
        path: "README.md",
        htmlUrl: "",
        screenshotUrls: ["https://raw.githubusercontent.com/a/b/HEAD/shot.png"],
      }),
      social: vi.fn().mockResolvedValue("https://repository-images.githubusercontent.com/1/x"),
    });
    expect(visual).toEqual({
      url: "https://raw.githubusercontent.com/a/b/HEAD/shot.png",
      kind: "screenshot",
    });
  });

  it("falls back to an uploaded social preview", async () => {
    const visual = await resolveRepositoryVisual("a", "b", {
      readme: vi.fn().mockResolvedValue(null),
      social: vi.fn().mockResolvedValue("https://repository-images.githubusercontent.com/1/x"),
    });
    expect(visual?.kind).toBe("social");
  });

  it("returns null when both sources fail", async () => {
    const visual = await resolveRepositoryVisual("a", "b", {
      readme: vi.fn().mockRejectedValue(new Error("rate limited")),
      social: vi.fn().mockRejectedValue(new Error("offline")),
    });
    expect(visual).toBeNull();
  });

  it("only accepts uploaded GitHub social images", () => {
    expect(
      parseSocialImage(
        '<meta property="og:image" content="https://repository-images.githubusercontent.com/663900193/abc" />',
      ),
    ).toBe("https://repository-images.githubusercontent.com/663900193/abc");
    // The auto-generated card is avatar + stats, not a visual.
    expect(
      parseSocialImage(
        '<meta property="og:image" content="https://opengraph.githubassets.com/deadbeef/a/b" />',
      ),
    ).toBeNull();
    expect(
      parseSocialImage('<meta property="og:image" content="https://evil.example/x.png" />'),
    ).toBeNull();
    expect(parseSocialImage("<html></html>")).toBeNull();
  });
});
