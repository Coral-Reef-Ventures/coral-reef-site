"use client";

import { Button, Group, SegmentedControl, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { InvitationStatus } from "../../../infrastructure/amplify/api.ts";
import { INVITATION_STATUSES } from "../../../infrastructure/amplify/api.ts";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { ConfirmButton, ErrorNotice, messageOf, ScrollRow, titleCase, useLoad } from "../../admin/shell/index.ts";
import { InviteForm } from "./InviteForm.tsx";
import { InvitationsTable, type InvitationActions } from "./InvitationsTable.tsx";

export function InvitationsView() {
  const [status, setStatus] = useState<InvitationStatus>("pending");
  const [result, reload] = useLoad(() => getAdminApi().listInvitations(status), [status]);
  const [error, setError] = useState<string>();

  // Every action reloads the list and shows a refusal rather than hiding it.
  const run = (action: () => Promise<unknown>) => async () => {
    setError(undefined);
    try {
      await action();
      reload();
    } catch (e) {
      setError(messageOf(e));
    }
  };
  const api = getAdminApi;
  const actions: InvitationActions = {
    revoke: (email) => run(() => api().revokeInvitation(email))(),
    restore: (email) => run(() => api().restoreInvitation(email))(),
    setGrants: (email, sites) => run(() => api().setGrants(email, sites))(),
    rebind: (email, newEmail) => run(() => api().rebindInvitation(email, newEmail))(),
    deletePerson: (personId) => run(() => api().deletePerson(personId))(),
  };

  return (
    <Stack gap="xl">
      <section aria-label="New invitation">
        <Title order={2} size="h3" mb="xs">
          New invitation
        </Title>
        <InviteForm onInvited={reload} />
      </section>
      <section aria-label="Invitations">
        <Title order={2} size="h3" mb="xs">
          Invitations
        </Title>
        <ScrollRow>
          <SegmentedControl
            aria-label="Status"
            value={status}
            onChange={(value) => setStatus(value as InvitationStatus)}
            data={INVITATION_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
          />
        </ScrollRow>
        {error ? <ErrorNotice message={error} /> : null}
        {result.state === "error" ? <ErrorNotice message={result.message} /> : null}
        {result.state === "ready" ? <InvitationsTable rows={result.data} actions={actions} /> : null}
      </section>
      <EraseAddress />
    </Stack>
  );
}

/** For someone whose address was submitted, by them or by another person: removes everything held under it. */
function EraseAddress() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <section aria-label="Erase an address">
      <Title order={2} size="h3" mb="xs">
        Erase an address
      </Title>
      <Stack gap="sm" maw={560}>
        <Text size="sm">
          Deletes every submission for the address and its Activity, and the person too if one exists.
        </Text>
        <TextInput label="Address" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <Group>
          {email.trim() ? (
            <ConfirmButton
              label="Erase"
              confirmLabel={`Erase everything held for ${email.trim()}`}
              onConfirm={async () => {
                setError(undefined);
                setMessage(undefined);
                try {
                  await getAdminApi().eraseEmail(email.trim());
                  setMessage("Erased.");
                  setEmail("");
                } catch (e) {
                  setError(messageOf(e));
                }
              }}
            />
          ) : (
            <Button variant="default" size="xs" disabled>
              Erase
            </Button>
          )}
        </Group>
        {message ? <Text role="status">{message}</Text> : null}
        {error ? <ErrorNotice message={error} /> : null}
      </Stack>
    </section>
  );
}
