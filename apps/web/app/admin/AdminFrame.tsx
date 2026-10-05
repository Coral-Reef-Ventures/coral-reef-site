"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AdminShell } from "../../src/features/admin/shell/index.ts";
import { prepareAdminApi } from "../../src/infrastructure/amplify/adminClient.ts";

/** Composition: binds the backend, then lets the views mount, since they ask for it as they load. */
export function AdminFrame({ title, children }: { title: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    prepareAdminApi().finally(() => setReady(true));
  }, []);
  return <AdminShell title={title}>{ready ? children : null}</AdminShell>;
}
