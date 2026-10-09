"use client";

import { useRef } from "react";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { useLoad } from "../../admin/shell/index.ts";
import { buildDirectory, type Directory, emptyDirectory } from "./model.ts";

/**
 * The invitations and submissions behind the ids, loaded once for the page: both views load them anyway, and a
 * submission detail page draws two activity lists from the one answer. A load that fails is not an error the view
 * reports — the table still draws, with the ids as they are.
 */
let pending: Promise<Directory> | undefined;

export function loadDirectory(): Promise<Directory> {
  pending ??= Promise.resolve()
    .then(() => {
      const api = getAdminApi();
      return Promise.all([api.listInvitations(), api.listSubmissions()]);
    })
    .then(([invitations, submissions]) => buildDirectory(invitations, submissions))
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function forgetDirectory(): void {
  pending = undefined;
}

/** The directory, loaded again when a view that changed something hands over a new `refreshKey`. */
export function useDirectory(refreshKey?: string): Directory {
  const loaded = useRef(false);
  const [result] = useLoad(() => {
    if (loaded.current) forgetDirectory();
    loaded.current = true;
    return loadDirectory();
  }, [refreshKey]);
  return result.state === "ready" ? result.data : emptyDirectory;
}
