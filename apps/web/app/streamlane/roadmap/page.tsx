import type { Metadata } from "next";

import { DoorDocument } from "../../../lib/page.tsx";
import { roadmapProduct } from "../../../lib/product-facts.ts";
import { StreamlaneRoadmap } from "../../../lib/roadmap-view.tsx";
import { loadRoadmapSnapshot } from "../../../lib/roadmap-snapshot.ts";
import { socialCardImages } from "../../../lib/social-card.ts";

const path = "/streamlane/roadmap/";
const title = "Streamlane's roadmap";
const description =
  "What the Streamlane team has committed to build and when, and the ideas it is weighing next, read from its public planning team.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    siteName: "Coral Reef Ventures",
    type: "website",
    locale: "en_US",
    title,
    description,
    url: path,
    images: socialCardImages,
  },
  twitter: { card: "summary_large_image", title, description, images: socialCardImages },
};

/**
 * Streamlane's roadmap (CRV-015), reached from Streamlane's card on the door. streamlane.app stays locked; the roadmap
 * is read at build from Streamlane's own planning team, which is public, and the page ships no client code. What the
 * build read is in .roadmap-snapshot.json (scripts/read-roadmap.ts); a read that failed shows no idea.
 */
export default function Page() {
  const { roadmap } = roadmapProduct(path);
  return (
    <DoorDocument
      file="streamlane-roadmap.md"
      slots={{ roadmap: <StreamlaneRoadmap snapshot={loadRoadmapSnapshot()} team={roadmap.team} /> }}
    />
  );
}
