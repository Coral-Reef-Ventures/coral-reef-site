"use client";

import { Button, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { AdminAccess } from "../../../infrastructure/amplify/api.ts";
import { ErrorNotice } from "./AdminShell.tsx";

/**
 * What stands before the views: nothing while the session is read; with no session, the door's sign-in; signed in
 * without the `admins` group, that fact and the door's sign-out; otherwise the views. A build with no backend shows the
 * views too, and each says it is not connected. `problem` is a failed sign-in's code.
 */
export function AdminGate({
  access,
  onSignIn,
  problem,
  children,
}: {
  access: AdminAccess | null;
  onSignIn: () => void;
  problem?: string;
  children: ReactNode;
}) {
  if (access === null) return null;
  if (access === "signed-out") {
    return (
      <Stack gap="md" align="flex-start">
        {problem ? <ErrorNotice message={problem} /> : null}
        <Button onClick={onSignIn}>Sign in</Button>
      </Stack>
    );
  }
  if (access === "not-admin") {
    return (
      <Stack gap="md" align="flex-start">
        <Text>This account is not an admin.</Text>
        <Button component="a" href="/signout/" variant="default">
          Sign out
        </Button>
      </Stack>
    );
  }
  return <>{children}</>;
}
