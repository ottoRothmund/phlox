"use client";

import { Warning } from "@phosphor-icons/react";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <Warning size={24} className="mx-auto" />
      <h1 className="mt-4 text-xl font-semibold">This page could not load</h1>
      <p className="mt-2 text-sm text-muted">
        GitHub may be rate-limiting or unavailable. Try again in a moment.
        {error.digest ? <span className="mt-1 block font-mono text-[11px] text-faint">{error.digest}</span> : null}
      </p>
      <button type="button" className="button-primary mt-6 h-9 px-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
