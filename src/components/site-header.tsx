"use client";

import { BookmarkSimple, Compass, MagnifyingGlass, Play } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { AuthMenu } from "@/components/auth-menu";
import type { SessionUser } from "@/lib/auth";

const links = [
  { href: "/feed", label: "Feed", icon: Play },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/search", label: "Search", icon: MagnifyingGlass },
  { href: "/collections", label: "Collections", icon: BookmarkSimple },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    /^(input|textarea|select)$/i.test(target.tagName)
  );
}

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses the header search from anywhere, matching the hint in the box.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const input = searchRef.current;
      if (!input || input.offsetParent === null) return;
      event.preventDefault();
      input.focus();
      input.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-[-0.02em]">
          <Image
            src="/phlox-logo.png"
            alt="Phlox flower"
            width={26}
            height={26}
            className="phlox-logo h-6 w-6 object-contain"
            priority
          />
          <span>Phlox</span>
        </Link>
        <nav aria-label="Primary" className="flex min-w-0 items-center self-stretch">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className="relative flex h-full items-center gap-1.5 px-3 text-sm text-muted transition-colors hover:text-foreground aria-[current=page]:text-foreground"
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-px bg-foreground" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          <form action="/search" className="hidden w-full max-w-sm md:block">
            <label className="relative block">
              <span className="sr-only">Search repositories</span>
              <MagnifyingGlass
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={searchRef}
                type="search"
                name="q"
                aria-label="Search repositories"
                placeholder="Search repositories, topics, languages"
                className="input h-9 w-full pl-9 pr-12"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 border border-border bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted">
                /
              </span>
            </label>
          </form>
          <ThemeToggle />
          <AuthMenu user={user} />
        </div>
      </div>
    </header>
  );
}
