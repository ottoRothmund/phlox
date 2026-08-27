import type { Repository } from "@/lib/repositories";

export interface Collection {
  id: string;
  name: string;
  description: string;
  repoFullNames: string[];
  repositorySnapshots?: Repository[];
  createdAt: string;
}

export type CollectionAction =
  | { type: "create"; collection: Collection }
  | { type: "delete"; collectionId: string }
  | { type: "rename"; collectionId: string; name: string }
  | {
      type: "toggle-repository";
      collectionId: string;
      repository: Repository;
    }
  | { type: "replace"; collections: Collection[] };

export const initialCollections: Collection[] = [
  {
    id: "daily-drivers",
    name: "Daily drivers",
    description: "Tools that improve the terminal and local development loop.",
    repoFullNames: ["astral-sh/uv", "jesseduffield/lazygit", "sxyazi/yazi"],
    createdAt: "2026-08-18T00:00:00Z",
  },
  {
    id: "private-computing",
    name: "Private computing",
    description: "Self-hosted software and privacy-respecting infrastructure.",
    repoFullNames: [
      "immich-app/immich",
      "mullvad/mullvadvpn-app",
      "openbao/openbao",
    ],
    createdAt: "2026-08-20T00:00:00Z",
  },
  {
    id: "protocol-watch",
    name: "Protocol watch",
    description: "Ethereum infrastructure and modular protocol implementations.",
    repoFullNames: [
      "paradigmxyz/reth",
      "ethereum-optimism/optimism",
    ],
    createdAt: "2026-08-22T00:00:00Z",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRepositorySnapshot(value: unknown): value is Repository {
  if (!isRecord(value)) return false;

  const stringFields = [
    "owner",
    "name",
    "fullName",
    "description",
    "language",
    "license",
    "createdAt",
    "updatedAt",
    "pushedAt",
  ];
  const numberFields = [
    "id",
    "stars",
    "forks",
    "openIssues",
    "watchers",
    "starDelta7d",
    "contributorCount",
  ];

  return (
    stringFields.every((field) => typeof value[field] === "string") &&
    numberFields.every(
      (field) =>
        typeof value[field] === "number" && Number.isFinite(value[field]),
    ) &&
    Array.isArray(value.topics) &&
    value.topics.every((topic) => typeof topic === "string") &&
    typeof value.isVerified === "boolean" &&
    ["homepage", "avatarUrl", "htmlUrl"].every(
      (field) => value[field] === undefined || typeof value[field] === "string",
    ) &&
    ["growthEstimated", "contributorsEstimated"].every(
      (field) => value[field] === undefined || typeof value[field] === "boolean",
    )
  );
}

export function parseStoredCollections(serialized: string): Collection[] | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return null;

    const valid = value.every(
      (collection) =>
        isRecord(collection) &&
        typeof collection.id === "string" &&
        typeof collection.name === "string" &&
        typeof collection.description === "string" &&
        typeof collection.createdAt === "string" &&
        Array.isArray(collection.repoFullNames) &&
        collection.repoFullNames.every(
          (fullName) => typeof fullName === "string",
        ) &&
        (collection.repositorySnapshots === undefined ||
          (Array.isArray(collection.repositorySnapshots) &&
            collection.repositorySnapshots.every(isRepositorySnapshot))),
    );

    return valid ? (value as Collection[]) : null;
  } catch {
    return null;
  }
}

export function resolveCollectionRepositories(
  collection: Collection,
  fallbackRepositories: Repository[],
): Repository[] {
  const snapshots = new Map(
    (collection.repositorySnapshots ?? []).map((repository) => [
      repository.fullName,
      repository,
    ]),
  );
  const fallbacks = new Map(
    fallbackRepositories.map((repository) => [
      repository.fullName,
      repository,
    ]),
  );

  return collection.repoFullNames.flatMap((fullName) => {
    const repository = snapshots.get(fullName) ?? fallbacks.get(fullName);
    return repository ? [repository] : [];
  });
}

export function collectionReducer(
  state: Collection[],
  action: CollectionAction,
): Collection[] {
  switch (action.type) {
    case "create":
      return state.some((collection) => collection.id === action.collection.id)
        ? state
        : [...state, action.collection];
    case "delete":
      return state.filter((collection) => collection.id !== action.collectionId);
    case "rename": {
      const name = action.name.trim();
      if (!name) return state;
      return state.map((collection) =>
        collection.id === action.collectionId
          ? { ...collection, name }
          : collection,
      );
    }
    case "toggle-repository":
      return state.map((collection) => {
        if (collection.id !== action.collectionId) return collection;
        const fullName = action.repository.fullName;
        const containsRepository = collection.repoFullNames.includes(
          fullName,
        );
        return {
          ...collection,
          repoFullNames: containsRepository
            ? collection.repoFullNames.filter(
                (savedFullName) => savedFullName !== fullName,
              )
            : [...collection.repoFullNames, fullName],
          repositorySnapshots: containsRepository
            ? (collection.repositorySnapshots ?? []).filter(
                (repository) => repository.fullName !== fullName,
              )
            : [
                ...(collection.repositorySnapshots ?? []).filter(
                  (repository) => repository.fullName !== fullName,
                ),
                action.repository,
              ],
        };
      });
    case "replace":
      return action.collections;
    default:
      return state;
  }
}
