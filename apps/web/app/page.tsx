import type { Metadata } from "next";

import { DoorDocument } from "../lib/page.tsx";
import { DoorForward } from "../src/features/access/door-session/index.ts";

const title = "Coral Reef Ventures · Documents. Intent. Work. Usage.";
const description = "Open foundations and focused tools for creating software with humans and AI working together.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { siteName: "Coral Reef Ventures", type: "website", locale: "en_US", title, description, url: "/" },
  twitter: { card: "summary", title, description },
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
