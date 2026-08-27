import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";
import type { SessionUser } from "@/lib/auth";

export function AppShell({
  children,
  user = null,
}: {
  children: ReactNode;
  user?: SessionUser | null;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <SiteHeader user={user} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Phlox indexes public repository signals for better discovery.</p>
          <div className="flex gap-4">
            <Link href="/explore" className="hover:text-foreground">Explore</Link>
            <a href="https://github.com" className="hover:text-foreground">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
