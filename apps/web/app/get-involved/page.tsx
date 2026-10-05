import type { Metadata } from "next";

import { DoorDocument } from "../../lib/page.tsx";
import { DoorSignIn } from "../../src/features/access/door-session/index.ts";
import { InterestForm } from "../../src/features/interest/interest-form/index.ts";

export const metadata: Metadata = {
  title: "Get involved",
  description:
    "Interested in taking part with funding, as a design partner or as an advisor? Tell us who you are and what you have in mind.",
  alternates: { canonical: "/get-involved/" },
};

/**
 * The form for anyone, and the sign-in for an invitee. A locked site's gate still sends a visitor to `/` with its
 * request in the query, and the home page forwards that here (DoorForward), so the sign-in reads it as before.
 */
export default function Page() {
  return (
    <DoorDocument
      file="get-involved.md"
      slots={{
        "interest-form": (
          <>
            <noscript>
              <p>The form needs scripting. Write to hello@coralreefventures.com instead.</p>
            </noscript>
            <InterestForm />
          </>
        ),
        "sign-in": (
          <>
            <noscript>
              <p>Signing in needs scripting.</p>
            </noscript>
            <DoorSignIn />
          </>
        ),
      }}
    />
  );
}
