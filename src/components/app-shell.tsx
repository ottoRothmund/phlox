import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
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
      <SiteFooter />
    </div>
  );
}
