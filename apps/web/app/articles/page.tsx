import type { Metadata } from "next";

import { feedPath } from "../../lib/articles.ts";
import { DoorDocument } from "../../lib/page.tsx";
import { socialCardImages } from "../../lib/social-card.ts";

const title = "Articles";
const description =
  "How Coral Reef Ventures thinks about building software when agents write the code, and what we learn building our own that way.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/articles/", types: { "application/rss+xml": feedPath } },
  openGraph: {
    siteName: "Coral Reef Ventures",
    type: "website",
    locale: "en_US",
    title,
    description,
    url: "/articles/",
    images: socialCardImages,
  },
  twitter: { card: "summary_large_image", title, description, images: socialCardImages },
};

/** The articles, newest first (CRV-016): its list is Markset generated from the one article table (lib/articles.ts). */
export default function Page() {
  return <DoorDocument file="articles.md" />;
}
