import type { Metadata } from "next";

import { DoorDocument } from "../../lib/page.tsx";
import { socialCardImages } from "../../lib/social-card.ts";

const title = "Before intent, there is a thought";
const description =
  "Eddy, in planning at Coral Reef Ventures: the step before intent, where a passing thought is written down and becomes context for people and agents.";

export const metadata: Metadata = {
  title: "Eddy",
  description,
  alternates: { canonical: "/eddy/" },
  openGraph: {
    siteName: "Coral Reef Ventures",
    type: "article",
    locale: "en_US",
    title,
    description,
    url: "/eddy/",
    images: socialCardImages,
  },
  twitter: { card: "summary_large_image", title, description, images: socialCardImages },
};

/**
 * Eddy and the step before intent, reached from the footer's "The step before intent" (2026-10-09). Eddy is in planning
 * and has no domain, card, mark or accent yet, so this page is its only place on the site and names no destination.
 */
export default function Page() {
  return <DoorDocument file="eddy.md" />;
}
