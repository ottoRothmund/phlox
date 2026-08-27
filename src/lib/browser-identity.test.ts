import { afterEach, describe, expect, it, vi } from "vitest";

import { getBrowserVisitorId } from "@/lib/browser-identity";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("browser visitor identity", () => {
  it("reuses one stored identity across calls", () => {
    const first = getBrowserVisitorId();
    expect(getBrowserVisitorId()).toBe(first);
  });

  it("stays stable within a session when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      },
      removeItem() {
        throw new Error("storage blocked");
      },
    });

    const first = getBrowserVisitorId();
    expect(getBrowserVisitorId()).toBe(first);
  });
});
