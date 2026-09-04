"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  // The feed owns the whole viewport; a footer under it would only be
  // reachable by scrolling the document, which breaks card snapping.
  if (pathname === "/feed") return null;

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Phlox indexes public repository signals for better discovery.</p>
        <div className="flex gap-4">
          <Link href="/explore" className="hover:text-foreground">Explore</Link>
          <a href="https://github.com" className="hover:text-foreground">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
