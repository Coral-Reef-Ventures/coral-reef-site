"use client";

import { Button, Group, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import type { Submission, SubmissionStatus } from "../../../infrastructure/amplify/api.ts";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { InviteForm } from "../../access/invitations/index.ts";
import { ErrorNotice, formatWhen, messageOf, titleCase, useLoad } from "../../admin/shell/index.ts";
import { ActivityList } from "../../people/activity/index.ts";
import { type Review, readSubmissionId, rebaseReview, selectableStatuses } from "./model.ts";

/**
 * One submission, by `?id=`: what the visitor wrote (shown as text, never as markup), a status and notes, the
 * invitation form, and the Activity for it. The page is a static export, so the id is read in the browser.
 */
export function SubmissionDetail() {
  const [id, setId] = useState<string | undefined | null>(null);
  useEffect(() => setId(readSubmissionId(window.location.search)), []);
  if (id === null) return null;
  if (id === undefined) return <ErrorNotice message="This link has no submission id." />;
  return <Loaded id={id} />;
}

function Loaded({ id }: { id: string }) {
  const [result, reload] = useLoad(() => getAdminApi().getSubmission(id), [id]);
  if (result.state === "loading") return <Text c="dimmed">Loading.</Text>;
  if (result.state === "error") return <ErrorNotice message={result.message} />;
  if (!result.data) return <ErrorNotice message="No submission has that id." />;
  return <Detail submission={result.data} reload={reload} />;
}

function Detail({ submission, reload }: { submission: Submission; reload: () => void }) {
  const [status, setStatus] = useState<SubmissionStatus>(submission.status);
  const [notes, setNotes] = useState(submission.notes);
  // What the form was seeded from. A reload after a save or an invite brings a new submission without remounting
  // (useLoad keeps the old result on screen while it reloads), so the form is moved onto it here, during render, as
  // React's "adjusting state when a prop changes" pattern does. Without this the select kept the status from before
  // an invite, the form read as dirty, and one Save sent that stale status back and undid the invite.
  const server: Review = { status: submission.status, notes: submission.notes };
  const [base, setBase] = useState<Review>(server);
  if (base.status !== server.status || base.notes !== server.notes) {
    const next = rebaseReview({ status, notes }, base, server);
    setBase(server);
    setStatus(next.status);
    setNotes(next.notes);
  }
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  // Decided once: the invite form stays on screen after it succeeds, so the admin can copy the text it shows.
  const [alreadyInvited] = useState(submission.status === "invited");
  const changeKey = `${submission.status}|${submission.notes}|${submission.reviewedAt ?? ""}|${submission.personId ?? ""}`;
  const dirty = status !== submission.status || notes !== submission.notes;

  async function save() {
    setError(undefined);
    setSaved(false);
    try {
      await getAdminApi().updateSubmission({ id: submission.id, status, notes });
      setSaved(true);
      reload();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <Stack gap="lg">
      <section aria-label="Submission">
        <Title order={2} size="h3">
          {submission.name}
        </Title>
        <Text>{submission.email}</Text>
        {submission.organization ? <Text c="dimmed">{submission.organization}</Text> : null}
        <Text size="sm" c="dimmed">
          Received {formatWhen(submission.receivedAt)} from {submission.sourceSite}. Interests:{" "}
          {submission.interests.map(titleCase).join(", ")}.
        </Text>
        <Text size="sm" c="dimmed" mt="xs">
          Written by the visitor and not verified.
        </Text>
        <Text mt="xs" style={{ whiteSpace: "pre-wrap" }}>
          {submission.message}
        </Text>
      </section>

      <section aria-label="Review">
        <Title order={2} size="h3" mb="xs">
          Review
        </Title>
        <Stack gap="sm" maw={560}>
          <Select
            label="Status"
            value={status}
            onChange={(value) => value && setStatus(value as SubmissionStatus)}
            allowDeselect={false}
            disabled={submission.status === "invited"}
            description={submission.status === "invited" ? "Set by the invitation." : undefined}
            data={selectableStatuses(submission.status).map((s) => ({ value: s, label: titleCase(s) }))}
          />
          <Textarea
            label="Notes"
            autosize
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Group>
            <Button onClick={save} disabled={!dirty}>
              Save
            </Button>
            {dirty ? (
              <Button
                variant="subtle"
                onClick={() => {
                  setStatus(submission.status);
                  setNotes(submission.notes);
                }}
              >
                Discard changes
              </Button>
            ) : null}
            {saved && !dirty ? <Text size="sm">Saved.</Text> : null}
          </Group>
          {error ? <ErrorNotice message={error} /> : null}
        </Stack>
      </section>

      <section aria-label="Invite">
        <Title order={2} size="h3" mb="xs">
          Invite
        </Title>
        {alreadyInvited ? (
          <Text c="dimmed">Already invited. Manage it under Invitations.</Text>
        ) : (
          <InviteForm initialEmail={submission.email} submissionId={submission.id} onInvited={reload} />
        )}
      </section>

      <section aria-label="Activity">
        <Title order={2} size="h3" mb="xs">
          Activity
        </Title>
        <ActivityList query={{ subjectId: submission.id }} refreshKey={changeKey} />
        {submission.personId ? (
          <>
            <Title order={3} size="h4" mt="md" mb="xs">
              The person
            </Title>
            <ActivityList query={{ personId: submission.personId }} refreshKey={changeKey} />
          </>
        ) : null}
      </section>
    </Stack>
  );
}
