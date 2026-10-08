import type { Metadata } from "next";

import { DoorDocument } from "../../lib/page.tsx";
import { socialCardImages } from "../../lib/social-card.ts";

const title = "Keeping product intent connected in agentic software development";
const description =
  "The opportunity and approach behind Coral Reef Ventures: why agentic development makes product intent harder to keep, and how open foundations and focused products can keep it connected.";

export const metadata: Metadata = {
  title: "Whitepaper",
  description,
  alternates: { canonical: "/whitepaper/" },
  openGraph: {
    siteName: "Coral Reef Ventures",
    type: "article",
    locale: "en_US",
    title,
    description,
    url: "/whitepaper/",
    images: socialCardImages,
  },
  twitter: { card: "summary_large_image", title, description, images: socialCardImages },
};

/** Gary's whitepaper (October 2026) in Markset, ungated. It is kept here only: there is no PDF to maintain beside it. */
export default function Page() {
  return <DoorDocument file="whitepaper.md" />;
}
