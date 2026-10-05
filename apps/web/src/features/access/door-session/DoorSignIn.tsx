"use client";

import { useEffect, useState } from "react";

import { doorApi } from "../../../infrastructure/amplify/client.ts";
import classes from "./DoorSignIn.module.css";
import { decodeRequest, type DoorRequest, enter, encodeRequest, readDoorRequest } from "./enter.ts";
import { getInvolvedPath } from "./forward.ts";
import { postTicket } from "./postTicket.ts";
import { type LockedSite, siteById } from "./sites.ts";

type View =
  | { kind: "working"; label: string }
  | { kind: "signin"; notice: string | null }
  | { kind: "continue"; grants: LockedSite[]; admin: boolean }
  | { kind: "failed" };

const contact = "hello@coralreefventures.com";

/** Cognito's own wording for why it refused: the backend's codes ride in `error_description`. */
const noticeFor = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const error = params.get("error") ?? "";
  if (error === "NOT_INVITED" || params.get("error_description")?.includes("NOT_INVITED")) {
    return "There is no invitation for that Google account yet. You can tell us about yourself in the form above.";
  }
  if (error === "ticket") return "That sign-in did not work. Please sign in again.";
  return null;
};

/**
 * The invitation sign-in (CRV-010). On `/get-involved/` it offers Google, naming the site when the query names a locked
 * one (`?site=`, from a gate's sign-in redirect or its coming-soon page's "Get involved" link); with that request and a live session it silently fetches a ticket and posts it (renewal); with a
 * session and no request it lists the sites to continue to.
 * On `/signed-in/` (`completing`) it first waits for Google's return to finish, then does the same. A person with no
 * invitation is sent back to `/get-involved/` with `?error=NOT_INVITED`, where the form is waiting.
 */
export const DoorSignIn = ({ completing = false }: { completing?: boolean }) => {
  const [view, setView] = useState<View>({ kind: "working", label: "Checking your sign-in…" });
  const [request, setRequest] = useState<DoorRequest | null>(null);
  const [destination, setDestination] = useState<LockedSite | null>(null);

  useEffect(() => {
    let live = true;
    const show = (next: View) => live && setView(next);

    const proceed = async (asked: DoorRequest | null) => {
      show({ kind: "working", label: "Opening the door…" });
      try {
        const entered = await enter(doorApi, asked);
        if (entered.kind === "ticket") {
          postTicket(entered.ticket);
        } else if (entered.kind === "continue") {
          show({ kind: "continue", grants: entered.grants, admin: entered.admin });
        } else {
          // Signed in, but not by an invitation this door recognizes: end that session and offer the form.
          await doorApi.signOut().catch(() => undefined);
          window.location.replace(`${getInvolvedPath}?error=NOT_INVITED`);
        }
      } catch {
        show({ kind: "failed" });
      }
    };

    const run = async () => {
      const search = window.location.search;
      const asked = readDoorRequest(search);
      setRequest(asked);
      setDestination(asked?.site ?? siteById(new URLSearchParams(search).get("site")) ?? null);

      if (completing) {
        if (/NOT_INVITED/.test(search)) {
          window.location.replace(`${getInvolvedPath}?error=NOT_INVITED`);
          return;
        }
        const outcome = await doorApi.completeRedirect();
        if (outcome.error !== undefined) {
          if (outcome.error.includes("NOT_INVITED")) {
            window.location.replace(`${getInvolvedPath}?error=NOT_INVITED`);
            return;
          }
          show({ kind: "failed" });
          return;
        }
        await proceed(decodeRequest(outcome.customState) ?? asked);
        return;
      }

      if (await doorApi.hasSession().catch(() => false)) {
        await proceed(asked);
        return;
      }
      show({ kind: "signin", notice: noticeFor(search) });
    };

    void run();
    return () => {
      live = false;
    };
  }, [completing]);

  const signIn = async () => {
    setView({ kind: "working", label: "Opening Google…" });
    try {
      await doorApi.signInWithGoogle(request ? encodeRequest(request) : undefined);
    } catch {
      setView({ kind: "failed" });
    }
  };

  return (
    <div className={classes.box} aria-live="polite">
      {view.kind === "working" && <p role="status">{view.label}</p>}
      {view.kind === "signin" && (
        <>
          {destination && (
            // The site the visitor is going to, by name only: no approved sentence names it yet (site-copy.md).
            <p className={classes.destination} data-site={destination.id}>
              {destination.name}
            </p>
          )}
          {view.notice && (
            <p role="status" className={classes.notice}>
              {view.notice}
            </p>
          )}
          <button type="button" className={classes.google} onClick={signIn}>
            Sign in with Google
          </button>
        </>
      )}
      {view.kind === "continue" && (
        <>
          <p>You are signed in.</p>
          <ul className={classes.list}>
            {view.grants.map((site) => (
              <li key={site.id}>
                <a className={classes.continue} href={`https://${site.host}/`}>
                  Continue to {site.name}
                </a>
              </li>
            ))}
            {view.admin && (
              <li>
                <a className={classes.continue} href="/admin/">
                  Admin
                </a>
              </li>
            )}
          </ul>
          <p>
            <a href="/signout/">Sign out</a>
          </p>
        </>
      )}
      {view.kind === "failed" && (
        <>
          <p role="alert" className={classes.notice}>
            Sign-in did not work. Please try again, or write to {contact}.
          </p>
          <p>
            <a href={`${getInvolvedPath}#invited`}>Try again</a>
          </p>
        </>
      )}
    </div>
  );
};
