"use client";

import {
  FolderOpen,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useCollections } from "@/components/collections-provider";
import { resolveCollectionRepositories } from "@/lib/collections";
import { mockRepositories } from "@/lib/mock-data";

export function CollectionsView() {
  const { collections, createCollection, deleteCollection } = useCollections();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    createCollection(name, description);
    setName("");
    setDescription("");
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="border-t border-border">
          {collections.map((collection) => {
            const repositories = resolveCollectionRepositories(
              collection,
              mockRepositories,
            );

            return (
              <section key={collection.id} className="border-b border-border py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.02em]">
                      {collection.name}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted">
                      {collection.description || "No description yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${collection.name}`}
                    className="button-ghost h-8 w-8 p-0 text-muted hover:text-foreground"
                    onClick={() => deleteCollection(collection.id)}
                  >
                    <Trash size={15} />
                  </button>
                </div>

                {repositories.length > 0 ? (
                  <div className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-2">
                    {repositories.map((repository) => (
                      <Link
                        key={repository.id}
                        href={`/repo/${repository.owner}/${repository.name}`}
                        className="group bg-surface p-4 hover:bg-subtle"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold">
                            {repository.fullName}
                          </span>
                          <span className="font-mono text-[11px] text-positive">
                            {repository.growthEstimated ? "~" : ""}+
                            {repository.starDelta7d.toLocaleString("en-US")}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">
                          {repository.description}
                        </p>
                        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
                          <span className="text-foreground">{repository.language}</span>
                          <span>{repository.stars.toLocaleString("en-US")} stars</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 flex items-center gap-3 border border-dashed border-border px-4 py-5 text-sm text-muted">
                    <FolderOpen size={18} />
                    Save a repository to populate this collection.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <aside>
        <form onSubmit={handleSubmit} className="sticky top-20 border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Plus size={16} />
            <h2 className="text-sm font-semibold">New collection</h2>
          </div>
          <label className="mt-5 block">
            <span className="mb-2 block text-xs font-medium">Collection name</span>
            <input
              className="input h-9 w-full px-3"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-medium">Collection description</span>
            <textarea
              className="input min-h-20 w-full resize-y px-3 py-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button type="submit" className="button-primary mt-4 h-9 w-full px-3">
            Create collection
          </button>
          <p className="mt-3 text-xs leading-5 text-muted">
            Collections are stored locally in this browser for the first version.
          </p>
        </form>
      </aside>
    </div>
  );
}
