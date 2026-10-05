"use client";

import { Anchor, Button, Checkbox, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useState } from "react";
import { SITES, type InviteResult, type SiteId } from "../../../infrastructure/amplify/api.ts";
import { getAdminApi } from "../../../infrastructure/amplify/client.ts";
import { ErrorNotice, messageOf } from "../../admin/shell/index.ts";
import { mailtoHref, validateInvite } from "./model.ts";

/**
 * Invite an address to chosen sites. On success it shows the invitation text with a copy button and a mail link:
 * the admin sends it from their own mail, so nothing here sends anything.
 */
export function InviteForm({
  initialEmail = "",
  submissionId,
  onInvited,
}: {
  initialEmail?: string;
  submissionId?: string;
  onInvited?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sites, setSites] = useState<SiteId[]>([]);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<{ field: string; message: string }>();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<InviteResult>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(undefined);
    setResult(undefined);
    setCopied(false);
    const found = validateInvite({ email, sites });
    setProblem(found);
    if (found) return;
    setBusy(true);
    try {
      setResult(await getAdminApi().invite({ email, sites, submissionId, note: note.trim() || undefined }));
      onInvited?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Stack gap="sm" maw={560}>
      <TextInput
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
        error={problem?.field === "email" ? problem.message : undefined}
      />
      <Checkbox.Group
        label="Sites"
        value={sites}
        onChange={(value) => setSites(value as SiteId[])}
        error={problem?.field === "sites" ? problem.message : undefined}
      >
        <Group mt="xs">
          {SITES.map((site) => (
            <Checkbox key={site} value={site} label={site} />
          ))}
        </Group>
      </Checkbox.Group>
      <Textarea
        label="Note (for you)"
        autosize
        minRows={2}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />
      <Group>
        <Button onClick={submit} loading={busy}>
          Invite
        </Button>
      </Group>
      {error ? <ErrorNotice message={error} /> : null}
      {result ? (
        <Stack gap="xs" role="status" aria-label="Invitation created">
          <Text>Invited {result.invitation.email}. Send them this from your own mail.</Text>
          <Textarea aria-label="Invitation text" readOnly autosize minRows={3} value={result.text} />
          <Group>
            <Button variant="default" onClick={() => copy(result.text)}>
              {copied ? "Copied" : "Copy invitation"}
            </Button>
            <Anchor href={mailtoHref(result.invitation.email, result.text)}>Open in mail</Anchor>
          </Group>
        </Stack>
      ) : null}
    </Stack>
  );
}
