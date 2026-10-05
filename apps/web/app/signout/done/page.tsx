import type { Metadata } from "next";

import { SignOutDone } from "../../../src/features/access/door-session/index.ts";

export const metadata: Metadata = { title: "Signed out", robots: { index: false, follow: false } };

/** Where Cognito's logout returns. It starts the walk through the locked sites' sign-out, which ends at /signout/. */
export default function Page() {
  return (
    <div className="door">
      <div className="door-slot">
        <h1>Signed out</h1>
        <SignOutDone />
        <noscript>
          <p>
            Your sign-in is ended. Each site clears its own session within the hour; <a href="/">back to the door</a>.
          </p>
        </noscript>
      </div>
    </div>
  );
}
