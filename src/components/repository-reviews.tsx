"use client";

import { useState } from "react";

import { getBrowserVisitorId } from "@/lib/browser-identity";
import type { RepositoryReview } from "@/lib/phlox-data";

function reviewDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function RepositoryReviews({
  fullName,
  initialReviews,
}: {
  fullName: string;
  initialReviews: RepositoryReview[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<"comment" | "review">("comment");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = displayName.trim();
    const normalizedBody = body.trim();
    if (
      normalizedName.length < 2 ||
      normalizedName.length > 40 ||
      normalizedBody.length < 2 ||
      normalizedBody.length > 2000
    ) {
      setError("Use a 2-40 character name and a 2-2,000 character entry.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/repositories/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          visitorId: getBrowserVisitorId(),
          displayName: normalizedName,
          kind,
          body: normalizedBody,
        }),
      });
      if (!response.ok) throw new Error("Review request failed.");
      const review = (await response.json()) as RepositoryReview;
      setReviews((current) => [review, ...current]);
      setBody("");
      try {
        window.localStorage.setItem("phlox.review-name.v1", normalizedName);
      } catch {
        // Posting still succeeds if this browser blocks preference storage.
      }
    } catch {
      setError("This entry could not be posted. Try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="community-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="community-heading"
            className="text-xl font-semibold tracking-[-0.025em]"
          >
            Comments and reviews
          </h2>
          <p className="mt-1 text-sm text-muted">
            Notes from people who have used or evaluated this repository.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted">
          {reviews.length}
        </span>
      </div>

      <form onSubmit={submitReview} className="mt-5 border border-border bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <label className="grid gap-1.5 text-xs font-medium">
            Display name
            <input
              className="input h-9 px-3"
              value={displayName}
              required
              aria-required="true"
              minLength={2}
              maxLength={40}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Entry type
            <select
              className="input h-9 px-3"
              required
              aria-required="true"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value === "review" ? "review" : "comment")
              }
            >
              <option value="comment">Comment</option>
              <option value="review">Review</option>
            </select>
          </label>
        </div>
        <label className="mt-4 grid gap-1.5 text-xs font-medium">
          Comment or review
          <textarea
            className="input min-h-28 resize-y px-3 py-2 leading-6"
            value={body}
            required
            aria-required="true"
            minLength={2}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted">Public on this repository page.</p>
          <button
            type="submit"
            className="button-primary h-9 px-3"
            disabled={submitting}
          >
            {submitting ? "Posting" : `Post ${kind}`}
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-xs text-negative">
            {error}
          </p>
        ) : null}
      </form>

      <div className="mt-6">
        {reviews.length === 0 ? (
          <div className="border-y border-border py-8 text-sm text-muted">
            No comments or reviews yet.
          </div>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="border-t border-border py-5 last:border-b">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold">{review.displayName}</span>
                <span className="text-xs font-medium text-muted">
                  {review.kind === "review" ? "Review" : "Comment"}
                </span>
                <time className="text-xs text-faint" dateTime={review.createdAt}>
                  {reviewDate(review.createdAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                {review.body}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
