import type { Metadata } from "next";

import { DoorDocument } from "../../lib/page.tsx";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using coralreefventures.com, and Streamlane and Driftline while they are open to invited guests.",
  alternates: { canonical: "/terms/" },
};

/** Google's consent screen for Streamlane links here, so the address is fixed. */
export default function Page() {
  return <DoorDocument file="terms.md" />;
}
