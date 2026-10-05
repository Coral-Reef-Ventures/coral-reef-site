"use client";

import { Badge, Button, Checkbox, Group, Stack, Table, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { INVITATION_STATUSES, SITES, type Invitation, type SiteId } from "../../../infrastructure/amplify/api.ts";
import { ConfirmButton, formatWhen } from "../../admin/shell/index.ts";
import { actionsFor } from "./model.ts";

export type InvitationActions = {
  revoke(email: string): void | Promise<void>;
  restore(email: string): void | Promise<void>;
  setGrants(email: string, sites: SiteId[]): void | Promise<void>;
  rebind(email: string, newEmail?: string): void | Promise<void>;
  deletePerson(personId: string): void | Promise<void>;
};

export function InvitationsTable({ rows, actions }: { rows: readonly Invitation[]; actions: InvitationActions }) {
  if (rows.length === 0) return <Text c="dimmed">No invitations with this status.</Text>;
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Address</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Sites</Table.Th>
            <Table.Th>Invited</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <InvitationRow key={row.email} row={row} actions={actions} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function InvitationRow({ row, actions }: { row: Invitation; actions: InvitationActions }) {
  const can = actionsFor(row);
  const [editing, setEditing] = useState<"grants" | "rebind" | undefined>();
  const [sites, setSites] = useState<SiteId[]>(row.sites);
  const [newEmail, setNewEmail] = useState("");
  return (
    <Table.Tr>
      <Table.Td>{row.email}</Table.Td>
      <Table.Td>
        <Badge variant="light" color={row.status === "revoked" ? "red" : undefined}>
          {row.status}
        </Badge>
        {row.bound ? (
          <Text size="xs" c="dimmed">
            Bound to a sign-in
          </Text>
        ) : null}
      </Table.Td>
      <Table.Td>{row.sites.length ? row.sites.join(", ") : "None"}</Table.Td>
      <Table.Td>{formatWhen(row.invitedAt)}</Table.Td>
      <Table.Td>
        <Stack gap="xs">
          <Group gap="xs">
            <Button variant="default" size="xs" onClick={() => setEditing(editing === "grants" ? undefined : "grants")}>
              Sites
            </Button>
            {can.rebind ? (
              <Button
                variant="default"
                size="xs"
                onClick={() => setEditing(editing === "rebind" ? undefined : "rebind")}
              >
                Rebind
              </Button>
            ) : null}
            {can.revoke ? (
              <ConfirmButton
                label="Revoke"
                confirmLabel={`Revoke ${row.email}`}
                onConfirm={() => actions.revoke(row.email)}
              />
            ) : null}
            {can.restore ? (
              <Button variant="default" size="xs" onClick={() => actions.restore(row.email)}>
                Restore
              </Button>
            ) : null}
            {row.personId ? (
              <ConfirmButton
                label="Delete person"
                confirmLabel="Delete this person and everything held about them"
                onConfirm={() => actions.deletePerson(row.personId as string)}
              />
            ) : null}
          </Group>
          {editing === "grants" ? (
            <Group gap="sm">
              <Checkbox.Group
                value={sites}
                onChange={(v) => setSites(v as SiteId[])}
                aria-label={`Sites for ${row.email}`}
              >
                <Group>
                  {SITES.map((site) => (
                    <Checkbox key={site} value={site} label={site} />
                  ))}
                </Group>
              </Checkbox.Group>
              <Button
                size="xs"
                onClick={async () => {
                  await actions.setGrants(row.email, sites);
                  setEditing(undefined);
                }}
              >
                Save sites
              </Button>
            </Group>
          ) : null}
          {editing === "rebind" ? (
            <Stack gap="xs" maw={420}>
              <Text size="sm">
                With a new address, the same person keeps their sign-in under it. Left empty, the binding is cleared and
                the old sign-in is disabled, so the next sign-in with this address starts afresh.
              </Text>
              <TextInput
                aria-label={`New address for ${row.email}`}
                placeholder="New address (optional)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.currentTarget.value)}
              />
              <ConfirmButton
                label="Rebind"
                confirmLabel={newEmail.trim() ? "Move to the new address" : "Clear the binding"}
                onConfirm={async () => {
                  await actions.rebind(row.email, newEmail.trim() || undefined);
                  setEditing(undefined);
                }}
              />
            </Stack>
          ) : null}
        </Stack>
      </Table.Td>
    </Table.Tr>
  );
}

export { INVITATION_STATUSES };
