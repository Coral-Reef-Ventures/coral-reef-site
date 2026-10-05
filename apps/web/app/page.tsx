import type { Metadata } from "next";

import { DoorDocument } from "../lib/page.tsx";
import { InterestForm } from "../src/features/interest/interest-form/index.ts";
import { DoorSignIn } from "../src/features/access/door-session/index.ts";

const title = "Coral Reef Ventures · Documents. Intent. Work. Usage.";
const description = "Open foundations and focused tools for creating software with humans and AI working together.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { siteName: "Coral Reef Ventures", type: "website", locale: "en_US", title, description, url: "/" },
  twitter: { card: "summary", title, description },
};

/** The door: the story, the form for anyone, the sign-in for an invitee. */
export default function Page() {
  return (
    <DoorDocument
      file="door.md"
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
