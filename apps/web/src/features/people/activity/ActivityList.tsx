"use client";

import { Table, Text } from "@mantine/core";
import type { Activity, ActivityQuery } from "../../../infrastructure/amplify/api.ts";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { ErrorNotice, formatWhen, useLoad } from "../../admin/shell/index.ts";
import { kindLabel } from "./model.ts";

export function ActivityTable({ rows }: { rows: readonly Activity[] }) {
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
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{formatWhen(row.at)}</Table.Td>
              <Table.Td>{kindLabel(row.kind)}</Table.Td>
              <Table.Td>
                {row.subjectType} {row.subjectId}
              </Table.Td>
              <Table.Td>{row.actorId}</Table.Td>
            </Table.Tr>
          ))}
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
  if (result.state === "error") return <ErrorNotice message={result.message} />;
  if (result.state === "loading") return <Text c="dimmed">Loading.</Text>;
  return <ActivityTable rows={result.data} />;
}
