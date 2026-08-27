import type { Metadata } from "next";

import { CollectionsView } from "@/components/collections-view";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14">
      <header className="border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Collections</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Keep focused lists of repositories for evaluation, research, and future projects.
        </p>
      </header>
      <div className="mt-8">
        <CollectionsView />
      </div>
    </div>
  );
}
