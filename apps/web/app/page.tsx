import type { Metadata } from "next";

import { DoorDocument } from "../lib/page.tsx";
import { DoorForward } from "../src/features/access/door-session/index.ts";
import { socialCardImages } from "../lib/social-card.ts";

const title = "Coral Reef Ventures · Keep control as agents build your software";
const description =
  "Agents can now write your code. Deciding what your product should do, and keeping every part of it true to those decisions, is still your team's job. Coral Reef Ventures builds open foundations and focused tools for that work.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "Coral Reef Ventures",
    type: "website",
    locale: "en_US",
    title,
    description,
    url: "/",
    images: socialCardImages,
  },
  twitter: { card: "summary_large_image", title, description, images: socialCardImages },
};

/**
 * The door: the story and the four offerings. The form and the sign-in are on /get-involved/, and DoorForward sends a
 * visit meant for them there, since a locked site's gate still redirects to `/`.
 */
export default function Page() {
  return (
    <>
      <DoorForward />
      <DoorDocument file="door.md" />
    </>
  );
}
