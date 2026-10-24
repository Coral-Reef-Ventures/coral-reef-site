"use client";

import { Box, SegmentedControl, Table, Text, Title, VisuallyHidden } from "@mantine/core";
import { useState } from "react";
import { getAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import type { PageCount } from "../../../infrastructure/amplify/api.ts";
import { ErrorNotice, ScrollRow, useLoad } from "../../admin/shell/index.ts";
import { barWidth, lastDays, type Ranked, topPages, topReferrers, total, totalsByDay, within } from "./model.ts";

export const RANGES = [7, 30] as const;
export type Range = (typeof RANGES)[number];

/** What the numbers are, said on the view itself, so nobody reads them as people. */
export const VISITS_NOTE =
  "Page requests, counted each day from the host's own access logs, with known bots left out. These are requests, not people: one person reading three pages is three, and a person who comes back is counted again. Today's requests are counted tomorrow.";

function RankedTable({ caption, heading, rows }: { caption: string; heading: string; rows: readonly Ranked[] }) {
  if (rows.length === 0) return <Text c="dimmed">None.</Text>;
  return (
    <Table.ScrollContainer minWidth={320}>
      <Table aria-label={caption}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{heading}</Table.Th>
            <Table.Th ta="right">Requests</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.key}>
              <Table.Td style={{ overflowWrap: "anywhere" }}>{row.label}</Table.Td>
              <Table.Td ta="right">{row.count}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** The report for `days`, from rows already loaded: totals per day with a bar each, the top pages and referrers. */
export function PageCountsReport({ rows, days }: { rows: readonly PageCount[]; days: readonly string[] }) {
  const shown = within(rows, days);
  const perDay = totalsByDay(shown, days);
  const largest = Math.max(0, ...perDay.map((d) => d.count));
  const sum = total(shown);
  return (
    <>
      <Text mb="md">
        {sum === 1 ? "1 page request" : `${sum} page requests`} in the last {days.length} days.
      </Text>
      <Title order={2} size="h4" mb="xs">
        Each day
      </Title>
      <Table.ScrollContainer minWidth={320} mb="lg">
        <Table aria-label="Requests each day">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Day (UTC)</Table.Th>
              <Table.Th ta="right">Requests</Table.Th>
              <Table.Th w="50%">
                <VisuallyHidden>Share of the busiest day</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...perDay].reverse().map((d) => (
              <Table.Tr key={d.day}>
                <Table.Td>{d.day}</Table.Td>
                <Table.Td ta="right">{d.count}</Table.Td>
                <Table.Td>
                  <Box
                    aria-hidden
                    h={8}
                    style={{
                      width: `${barWidth(d.count, largest)}%`,
                      background: "var(--mantine-color-gray-6)",
                      borderRadius: 2,
                    }}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Title order={2} size="h4" mb="xs">
        Pages
      </Title>
      <Box mb="lg">
        <RankedTable caption="Most requested pages" heading="Page" rows={topPages(shown)} />
      </Box>
      <Title order={2} size="h4" mb="xs">
        Where the requests came from
      </Title>
      <RankedTable caption="Referring sites" heading="Site" rows={topReferrers(shown)} />
    </>
  );
}

/** The last 30 days of this site's page counts, loaded once, shown for 7 or 30 of them. */
export function VisitsView() {
  const [range, setRange] = useState<Range>(30);
  // The view counts the site it is served from; loaded in the browser, where the static export has a host.
  const [result] = useLoad(() => {
    const days = lastDays(new Date(), 30);
    const site = window.location.host;
    return getAdminApi()
      .listPageCounts(site, days[0] ?? "", days.at(-1) ?? "")
      .then((rows) => ({ rows, site }));
  }, []);
  return (
    <>
      <Text c="dimmed" mb="md" maw="70ch">
        {VISITS_NOTE}
      </Text>
      <ScrollRow>
        <SegmentedControl
          aria-label="Range"
          value={String(range)}
          onChange={(value) => setRange(Number(value) as Range)}
          data={RANGES.map((days) => ({ value: String(days), label: `${days} days` }))}
        />
      </ScrollRow>
      {result.state === "error" ? <ErrorNotice message={result.message} /> : null}
      {result.state === "loading" ? <Text c="dimmed">Loading.</Text> : null}
      {result.state === "ready" ? (
        <>
          <Text size="sm" c="dimmed" mb="xs">
            {result.data.site}
          </Text>
          <PageCountsReport rows={result.data.rows} days={lastDays(new Date(), range)} />
        </>
      ) : null}
    </>
  );
}
