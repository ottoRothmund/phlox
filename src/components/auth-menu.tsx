"use client";

import { GithubLogo, GoogleLogo, SignOut, User } from "@phosphor-icons/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import type { SessionUser } from "@/lib/auth";

const menuClass =
  "absolute right-0 top-11 z-30 w-[min(15rem,calc(100vw-2rem))] border border-border bg-surface p-1 shadow-sm";

export function AuthMenu({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const next = encodeURIComponent(pathname || "/");

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="button-secondary h-9 gap-1.5 px-3 text-sm"
        >
          <User size={15} aria-hidden="true" />
          Sign in
        </button>
        {open ? (
          <div className={menuClass}>
            <p className="px-3 py-2 text-[11px] text-muted">
              Sign in to keep collections and reactions across devices.
            </p>
            <a
              href={`/api/auth/signin/github?next=${next}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-subtle"
            >
              <GithubLogo size={16} aria-hidden="true" />
              Continue with GitHub
            </a>
            <a
              href={`/api/auth/signin/google?next=${next}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-subtle"
            >
              <GoogleLogo size={16} aria-hidden="true" />
              Continue with Google
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 border border-border px-2 text-sm hover:bg-subtle"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <User size={15} aria-hidden="true" />
        )}
        <span className="max-w-[9rem] truncate">{user.name}</span>
      </button>
      {open ? (
        <div className={menuClass}>
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            {user.email ? (
              <p className="truncate text-[11px] text-muted">{user.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-subtle disabled:opacity-60"
          >
            <SignOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
