import type { Metadata } from "next";

import { DoorDocument } from "../../lib/page.tsx";

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
  },
  twitter: { card: "summary", title, description },
};

/** Gary's whitepaper (draft, October 2026) in Markset, ungated, with the PDF it came from beside it. */
export default function Page() {
  return <DoorDocument file="whitepaper.md" />;
}
