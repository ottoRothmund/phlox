import type { Metadata } from "next";

import { DiscoveryFeed } from "@/components/discovery-feed";
import { buildFeed } from "@/app/api/feed/route";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "Swipe through GitHub one repository at a time. Rising projects, deep cuts, and brand-new releases, tuned to what you like.",
};

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  // The first batch is rendered on the server so the page has cards before
  // any JavaScript runs. Taste lives in the browser, so this batch is
  // taste-free; the client applies taste from the second batch onward.
  const initial = await buildFeed({}).catch(() => undefined);
  return <DiscoveryFeed initial={initial} />;
}
