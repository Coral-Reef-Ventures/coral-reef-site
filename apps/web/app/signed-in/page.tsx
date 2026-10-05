import type { Metadata } from "next";

import { DoorSignIn } from "../../src/features/access/door-session/index.ts";

export const metadata: Metadata = { title: "Signing in", robots: { index: false, follow: false } };

/** Where Google returns: finishes the sign-in, then posts a ticket or lists the sites to continue to. */
export default function Page() {
  return (
    <div className="door">
      <div className="door-slot">
        <h1>Signing you in</h1>
        <noscript>
          <p>Signing in needs scripting.</p>
        </noscript>
        <DoorSignIn completing />
      </div>
    </div>
  );
}
