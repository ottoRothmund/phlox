import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryReaction } from "@/components/repository-reaction";

describe("repository reactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stores one mutually exclusive like or dislike", () => {
    render(<RepositoryReaction fullName="northstar/forge" />);

    const like = screen.getByRole("button", { name: "Like northstar/forge" });
    const dislike = screen.getByRole("button", {
      name: "Dislike northstar/forge",
    });

    fireEvent.click(like);
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(dislike).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("phlox.reaction.northstar/forge")).toBe(
      "like",
    );

    fireEvent.click(dislike);
    expect(like).toHaveAttribute("aria-pressed", "false");
    expect(dislike).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("phlox.reaction.northstar/forge")).toBe(
      "dislike",
    );

    fireEvent.click(dislike);
    expect(dislike).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("phlox.reaction.northstar/forge")).toBeNull();
  });

  it("ignores invalid stored reactions", async () => {
    window.localStorage.setItem("phlox.reaction.northstar/forge", "love");

    render(<RepositoryReaction fullName="northstar/forge" />);
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 10)));

    expect(
      screen.getByRole("button", { name: "Like northstar/forge" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Dislike northstar/forge" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("updates the UI when localStorage writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    render(<RepositoryReaction fullName="northstar/forge" />);
    const like = screen.getByRole("button", { name: "Like northstar/forge" });
    fireEvent.click(like);

    expect(like).toHaveAttribute("aria-pressed", "true");
  });

  it("does not overwrite a fresh click with deferred stored state", () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      "phlox.reaction.northstar/forge",
      "dislike",
    );
    render(<RepositoryReaction fullName="northstar/forge" />);

    const like = screen.getByRole("button", { name: "Like northstar/forge" });
    fireEvent.click(like);
    act(() => vi.runAllTimers());

    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("phlox.reaction.northstar/forge")).toBe(
      "like",
    );
  });

  it("clears reaction state when the repository changes", () => {
    vi.useFakeTimers();
    window.localStorage.setItem("phlox.reaction.northstar/forge", "like");
    const { rerender } = render(
      <RepositoryReaction fullName="northstar/forge" />,
    );
    act(() => vi.runAllTimers());

    rerender(<RepositoryReaction fullName="northstar/trail" />);
    act(() => vi.runAllTimers());

    expect(
      screen.getByRole("button", { name: "Like northstar/trail" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Dislike northstar/trail" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows shared counts and replaces them with the server result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ likes: 19, dislikes: 3, reaction: "like" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RepositoryReaction
        fullName="northstar/forge"
        initialCounts={{ likes: 18, dislikes: 3 }}
      />,
    );

    const group = screen.getByRole("group", {
      name: "React to northstar/forge",
    });
    expect(within(group).getByText("18")).toBeInTheDocument();
    expect(within(group).getByText("3")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Like northstar/forge" }),
    );

    await waitFor(() => expect(within(group).getByText("19")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repositories/reactions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
