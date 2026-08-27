import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryReviews } from "@/components/repository-reviews";

const initialReview = {
  id: "a3464fb1-a1bc-47ef-9b24-f5877b5a229b",
  fullName: "northstar/forge",
  displayName: "Mina",
  kind: "review" as const,
  body: "Fast setup and unusually clear documentation.",
  createdAt: "2026-08-24T12:00:00Z",
};

describe("repository reviews", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders public comments and reviews", () => {
    render(
      <RepositoryReviews
        fullName="northstar/forge"
        initialReviews={[initialReview]}
      />,
    );

    expect(screen.getByText("Mina")).toBeInTheDocument();
    const entry = screen.getByText(initialReview.body).closest("article");
    expect(entry).not.toBeNull();
    expect(within(entry as HTMLElement).getByText("Review")).toBeInTheDocument();
  });

  it("posts a review and adds the server result", async () => {
    const createdReview = {
      ...initialReview,
      id: "92eab7d5-8ea9-4204-a464-84a41f0e02fa",
      displayName: "Otto",
      body: "The topic navigation makes the project much easier to place.",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdReview), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<RepositoryReviews fullName="northstar/forge" initialReviews={[]} />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Otto" },
    });
    fireEvent.change(screen.getByLabelText("Entry type"), {
      target: { value: "review" },
    });
    fireEvent.change(screen.getByLabelText("Comment or review"), {
      target: { value: createdReview.body },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post review" }));

    await waitFor(() => expect(screen.getByText(createdReview.body)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/repositories/reviews",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
