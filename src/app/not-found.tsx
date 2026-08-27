import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <p className="font-mono text-xs text-muted">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Repository not found</h1>
      <p className="mt-2 text-sm text-muted">It may be private, renamed, or unavailable from GitHub.</p>
      <Link href="/search" className="button-primary mt-6 h-9 px-4">Search repositories</Link>
    </div>
  );
}
