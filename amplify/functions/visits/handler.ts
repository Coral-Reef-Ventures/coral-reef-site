import process from "node:process";

import { AmplifyClient, GenerateAccessLogsCommand } from "@aws-sdk/client-amplify";

import { expiresAt, retention } from "../../areas/retention.ts";
import { parseVisits, type VisitsSettings } from "../../auth/settings.ts";
import { dynamoStore } from "../shared/dynamo-store.ts";
import { errorName, log } from "../shared/log.ts";
import { row } from "../shared/models.ts";
import type { Store } from "../shared/store.ts";
import { tableEnvironment } from "../shared/tables.ts";
import { countPages, logText, pageCountId } from "./count.ts";

export type LogRange = { appId: string; domain: string; start: Date; end: Date };

export type VisitsDeps = {
  /** Where the logs are; undefined in a sandbox, which has no hosted app to count. */
  settings: VisitsSettings | undefined;
  /** The presigned address of the access log for a range (Amplify's GenerateAccessLogs). */
  logUrl(range: LogRange): Promise<string>;
  /** The log's bytes, compressed or not. */
  download(url: string): Promise<Uint8Array>;
  store: Store;
  now(): Date;
};

const dayMs = 24 * 60 * 60 * 1000;

/** The UTC day `n` days before `now`'s, as YYYY-MM-DD. */
export const dayBefore = (now: Date, n: number): string =>
  new Date(now.getTime() - n * dayMs).toISOString().slice(0, 10);

/**
 * The days a run counts: yesterday, and the day before again, because a host's log of a day's last hour can arrive after
 * midnight. Each row's id is its day, path and referrer, so counting a day again overwrites it rather than adding.
 */
export const daysToCount = (now: Date): string[] => [dayBefore(now, 1), dayBefore(now, 2)];

/**
 * crv-visits (CRV-017): counts each day's page requests from the host's access logs and writes the counts. It logs a
 * day, counts and an error's name: never a row of the log, an address, a browser or the log's own URL. A day that fails
 * is logged and the run goes on to the next, then fails, so the errors alarm says so; the next run counts it again.
 */
export const createVisits = (deps: VisitsDeps) => async () => {
  const { settings } = deps;
  if (!settings) {
    log("visits.skipped", { reason: "unconfigured" });
    return { days: 0, failed: 0 };
  }
  const now = deps.now();
  let failed = 0;
  const days = daysToCount(now);
  for (const day of days) {
    try {
      const url = await deps.logUrl({
        appId: settings.appId,
        domain: settings.domain,
        start: new Date(`${day}T00:00:00.000Z`),
        end: new Date(`${day}T23:59:59.999Z`),
      });
      const tally = countPages(logText(await deps.download(url)), settings.host, day);
      for (const counted of tally.rows) {
        await deps.store.write({
          put: {
            table: "PageCount",
            item: row(
              "PageCount",
              {
                id: pageCountId(counted),
                site: settings.host,
                day: counted.day,
                path: counted.path,
                referrer: counted.referrer,
                count: counted.count,
                expiresAt: expiresAt(new Date(`${counted.day}T00:00:00.000Z`), retention.pageCount),
              },
              now,
            ),
          },
        });
      }
      log("visits.counted", { day, rows: tally.rows.length, counted: tally.counted, seen: tally.seen, status: "ok" });
    } catch (error) {
      failed += 1;
      log("visits.failed", { day, error: errorName(error) });
    }
  }
  // Thrown without the cause, whose message may quote the log's URL; the lines above already name each failure.
  if (failed) throw new Error(`crv-visits could not count ${failed} of ${days.length} days`);
  return { days: days.length, failed };
};

const amplify = new AmplifyClient({});

export const handler = createVisits({
  settings: parseVisits(process.env),
  async logUrl({ appId, domain, start, end }) {
    const { logUrl } = await amplify.send(
      new GenerateAccessLogsCommand({ appId, domainName: domain, startTime: start, endTime: end }),
    );
    if (!logUrl) throw new Error("GenerateAccessLogs returned no log");
    return logUrl;
  },
  async download(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The access log answered ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  store: dynamoStore(tableEnvironment(process.env)),
  now: () => new Date(),
});
