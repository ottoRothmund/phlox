"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  collectionReducer,
  initialCollections,
  parseStoredCollections,
  type Collection,
} from "@/lib/collections";
import type { Repository } from "@/lib/repositories";

const STORAGE_KEY = "phlox.collections.v1";

interface CollectionsContextValue {
  collections: Collection[];
  createCollection: (name: string, description?: string) => void;
  deleteCollection: (collectionId: string) => void;
  renameCollection: (collectionId: string, name: string) => void;
  toggleRepository: (collectionId: string, repository: Repository) => void;
  isSaved: (fullName: string) => boolean;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, dispatch] = useReducer(
    collectionReducer,
    initialCollections,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseStoredCollections(saved);
        if (parsed) {
          dispatch({ type: "replace", collections: parsed });
        }
      }
    } catch {
      // Ignore invalid local data and retain the starter collections.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    } catch {
      // Collection state still works for this session when storage is unavailable.
    }
  }, [collections, hydrated]);

  const createCollection = useCallback((name: string, description = "") => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const idBase = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "collection";
    dispatch({
      type: "create",
      collection: {
        id: `${idBase}-${Date.now().toString(36)}`,
        name: cleanName,
        description: description.trim(),
        repoFullNames: [],
        createdAt: new Date().toISOString(),
      },
    });
  }, []);

  const deleteCollection = useCallback((collectionId: string) => {
    dispatch({ type: "delete", collectionId });
  }, []);

  const renameCollection = useCallback(
    (collectionId: string, name: string) => {
      dispatch({ type: "rename", collectionId, name });
    },
    [],
  );

  const toggleRepository = useCallback(
    (collectionId: string, repository: Repository) => {
      dispatch({ type: "toggle-repository", collectionId, repository });
    },
    [],
  );

  const isSaved = useCallback(
    (fullName: string) =>
      collections.some((collection) =>
        collection.repoFullNames.includes(fullName),
      ),
    [collections],
  );

  const value = useMemo(
    () => ({
      collections,
      createCollection,
      deleteCollection,
      renameCollection,
      toggleRepository,
      isSaved,
    }),
    [
      collections,
      createCollection,
      deleteCollection,
      renameCollection,
      toggleRepository,
      isSaved,
    ],
  );

  return (
    <CollectionsContext.Provider value={value}>
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections(): CollectionsContextValue {
  const value = useContext(CollectionsContext);
  if (!value) {
    throw new Error("useCollections must be used inside CollectionsProvider");
  }
  return value;
}
