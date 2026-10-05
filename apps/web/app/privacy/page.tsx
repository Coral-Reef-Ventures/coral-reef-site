import type { Metadata } from "next";

import { DoorDocument } from "../../lib/page.tsx";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What the interest form and the invitation sign-in store, and for how long.",
  alternates: { canonical: "/privacy/" },
};

/** Google's consent screen links here, so the address is fixed. */
export default function Page() {
  return <DoorDocument file="privacy.md" />;
}
