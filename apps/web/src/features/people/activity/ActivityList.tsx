"use client";

import { Table, Text } from "@mantine/core";
import type { Activity, ActivityQuery } from "../../../infrastructure/amplify/api.ts";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { ErrorNotice, formatWhen, useLoad } from "../../admin/shell/index.ts";
import { useDirectory } from "./directory.ts";
import { describeActor, describeSubject, detailSummary, type Directory, emptyDirectory, kindLabel } from "./model.ts";

export function ActivityTable({
  rows,
  directory = emptyDirectory,
}: {
  rows: readonly Activity[];
  directory?: Directory;
}) {
  if (rows.length === 0) return <Text c="dimmed">No activity.</Text>;
  return (
    <Table.ScrollContainer minWidth={520}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>When</Table.Th>
            <Table.Th>What</Table.Th>
            <Table.Th>Subject</Table.Th>
            <Table.Th>By</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const subject = describeSubject(row, directory);
            const actor = describeActor(row.actorId, directory);
            const summary = detailSummary(row.detail);
            return (
              <Table.Tr key={row.id}>
                <Table.Td>{formatWhen(row.at)}</Table.Td>
                <Table.Td>
                  {kindLabel(row.kind)}
                  {summary ? <Text span c="dimmed">{` · ${summary}`}</Text> : null}
                </Table.Td>
                <Table.Td title={subject.title}>{subject.text}</Table.Td>
                <Table.Td title={actor.title}>{actor.text}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Activity loaded for a query, again when `refreshKey` changes. The detail page uses it for a submission and for its person. */
export function ActivityList({ query, refreshKey }: { query: ActivityQuery; refreshKey?: string }) {
  const [result] = useLoad(
    () => getAdminApi().listActivity(query),
    [query.area, query.personId, query.subjectId, refreshKey],
  );
  const directory = useDirectory(refreshKey);
  if (result.state === "error") return <ErrorNotice message={result.message} />;
  if (result.state === "loading") return <Text c="dimmed">Loading.</Text>;
  return <ActivityTable rows={result.data} directory={directory} />;
}
