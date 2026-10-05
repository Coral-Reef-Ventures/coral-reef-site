"use client";

import { useEffect, useState } from "react";

import { doorApi } from "../../../infrastructure/amplify/client.ts";
import { signoutChainStart } from "./sites.ts";

/**
 * `/signout/`. With a live session it ends it everywhere, which leaves for Cognito's logout and returns to
 * `/signout/done/`. Without one there is nothing to end, which is also where the sites' sign-out chain finishes, so it
 * only says so and never starts a walk: nothing here can loop.
 */
export const SignOut = () => {
  const [state, setState] = useState<"working" | "out" | "failed">("working");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (await doorApi.hasSession()) {
          await doorApi.signOut();
          // Reached only when the sign-out did not leave the page; it has ended the session either way.
        }
        if (live) setState("out");
      } catch {
        if (live) setState("failed");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state === "working") return <p role="status">Signing you out…</p>;
  if (state === "failed") {
    return (
      <p role="alert">
        Signing out did not finish. Close this browser window to end the session, or write to
        hello@coralreefventures.com.
      </p>
    );
  }
  return <p role="status">You are signed out.</p>;
};

/** `/signout/done/`: Cognito's session is over, so clear each locked site's cookie by the fixed chain. */
export const SignOutDone = () => {
  const [walking, setWalking] = useState(true);
  useEffect(() => {
    // The chain's last site returns to /signout/, a page that only reports. The walk starts only from here.
    const timer = setTimeout(() => setWalking(false), 8000);
    window.location.replace(signoutChainStart());
    return () => clearTimeout(timer);
  }, []);
  return walking ? (
    <p role="status">Signing you out of the sites…</p>
  ) : (
    <p role="status">You are signed out of the door. The sites clear their own session within the hour.</p>
  );
};
