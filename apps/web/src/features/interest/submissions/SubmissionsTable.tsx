import { Badge, Group, Table, Text } from "@mantine/core";
import Link from "next/link";
import type { Submission } from "../../../infrastructure/amplify/api.ts";
import { formatWhen, titleCase } from "../../admin/shell/format.ts";
import { isStale } from "./model.ts";

/** The rows of one status. Presentational: the view loads and filters, this draws. */
export function SubmissionsTable({ rows, now }: { rows: readonly Submission[]; now: Date }) {
  if (rows.length === 0) return <Text c="dimmed">No submissions with this status.</Text>;
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Received</Table.Th>
            <Table.Th>From</Table.Th>
            <Table.Th>Interests</Table.Th>
            <Table.Th>Site</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{formatWhen(row.receivedAt)}</Table.Td>
              <Table.Td>
                <Link href={`/admin/submission/?id=${encodeURIComponent(row.id)}`}>{row.name || row.email}</Link>
                {row.organization ? (
                  <Text size="sm" c="dimmed">
                    {row.organization}
                  </Text>
                ) : null}
              </Table.Td>
              <Table.Td>{row.interests.map(titleCase).join(", ")}</Table.Td>
              <Table.Td>{row.sourceSite}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Badge variant="light">{row.status}</Badge>
                  {isStale(row, now) ? (
                    <Badge color="orange" variant="light">
                      Over 30 days
                    </Badge>
                  ) : null}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
