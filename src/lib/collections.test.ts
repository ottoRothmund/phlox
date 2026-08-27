import { describe, expect, it } from "vitest";

import {
  collectionReducer,
  initialCollections,
  parseStoredCollections,
  type Collection,
} from "@/lib/collections";
import { mockRepositories } from "@/lib/mock-data";

describe("collection reducer", () => {
  it("creates a named collection", () => {
    const next = collectionReducer(initialCollections, {
      type: "create",
      collection: {
        id: "infra-watch",
        name: "Infra watch",
        description: "Storage and deployment projects",
        repoFullNames: [],
        createdAt: "2026-08-24T00:00:00Z",
      },
    });

    expect(next.some((collection) => collection.id === "infra-watch")).toBe(true);
  });

  it("adds and removes a repository without duplicates", () => {
    const repository = mockRepositories[0];
    const collection: Collection = {
      id: "saved",
      name: "Saved",
      description: "",
      repoFullNames: [],
      createdAt: "2026-08-24T00:00:00Z",
    };

    const added = collectionReducer([collection], {
      type: "toggle-repository",
      collectionId: "saved",
      repository,
    });
    const removed = collectionReducer(added, {
      type: "toggle-repository",
      collectionId: "saved",
      repository,
    });

    expect(added[0].repoFullNames).toEqual(["astral-sh/uv"]);
    expect(added[0].repositorySnapshots).toEqual([repository]);
    expect(removed[0].repoFullNames).toEqual([]);
    expect(removed[0].repositorySnapshots).toEqual([]);
  });

  it("renames a collection while preserving its repositories", () => {
    const renamed = collectionReducer(initialCollections, {
      type: "rename",
      collectionId: initialCollections[0].id,
      name: "Daily drivers",
    });

    expect(renamed[0].name).toBe("Daily drivers");
    expect(renamed[0].repoFullNames).toEqual(initialCollections[0].repoFullNames);
  });

  it("accepts legacy stored collections and rejects malformed shapes", () => {
    expect(parseStoredCollections(JSON.stringify(initialCollections))).toEqual(
      initialCollections,
    );
    expect(
      parseStoredCollections(
        JSON.stringify([
          {
            ...initialCollections[0],
            repoFullNames: null,
          },
        ]),
      ),
    ).toBeNull();
    expect(parseStoredCollections("not json")).toBeNull();
  });
});
