import type { Metadata } from "next";

import { SignOut } from "../../src/features/access/door-session/index.ts";

export const metadata: Metadata = { title: "Sign out", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="door">
      <div className="door-slot">
        <h1>Sign out</h1>
        <SignOut />
        <p>
          <a href="/">Back to the door</a>
        </p>
      </div>
    </div>
  );
}
