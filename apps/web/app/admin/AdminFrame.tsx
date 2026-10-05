"use client";

import { type ReactNode, useEffect, useState } from "react";
import { encodeAdminReturn } from "../../src/features/access/door-session/index.ts";
import { AdminGate, AdminShell } from "../../src/features/admin/shell/index.ts";
import { prepareAdminApi } from "../../src/infrastructure/amplify/adminClient.ts";
import type { AdminAccess } from "../../src/infrastructure/amplify/api.ts";
import { doorApi } from "../../src/infrastructure/amplify/client.ts";

/**
 * Composition: reads the session and binds the backend, then lets the views mount, since they ask for it as they load.
 * Signing in is the door's own Google sign-in, carrying this page through Google so `/signed-in/` comes back here.
 */
export function AdminFrame({ title, children }: { title: string; children: ReactNode }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    let live = true;
    // A binding that could not even be attempted leaves the views to say the backend is not connected.
    prepareAdminApi().then(
      (next) => live && setAccess(next),
      () => live && setAccess("no-backend"),
    );
    return () => {
      live = false;
    };
  }, []);

  const signIn = () => {
    setProblem(undefined);
    doorApi
      .signInWithGoogle(encodeAdminReturn(window.location.pathname + window.location.search))
      .catch(() => setProblem("SIGN_IN_FAILED"));
  };

  return (
    <AdminShell title={title}>
      <AdminGate access={access} onSignIn={signIn} problem={problem}>
        {children}
      </AdminGate>
    </AdminShell>
  );
}
