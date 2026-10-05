/**
 * The one way the functions log: an event kind, ids and a status, as one JSON line. Nothing personal or secret is
 * logged, ever: no request body, message, email address, cookie, ticket or token (plan §2.3a). The fields are typed so
 * that a value which is not an id, a count or a word does not fit, and each function's test runs a sample event and
 * fails if any of its personal or secret values reach the console.
 */
export type LogFields = Record<string, string | number | boolean | undefined>;

/** Words that are safe to log: an event kind, a status, an error's name. */
const word = /^[\w.:-]{0,80}$/;

export const log = (kind: string, fields: LogFields = {}): void => {
  const safe: LogFields = {};
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    // A string that is not a plain word or id is replaced, so a mistake here cannot leak an address or a message.
    safe[name] = typeof value === "string" && !word.test(value) ? "[redacted]" : value;
  }
  // The function's log is CloudWatch, and this is the one line that writes it.
  console.log(JSON.stringify({ kind, ...safe }));
};

/**
 * A count metric in CloudWatch's embedded metric format: the log line becomes a metric with no dimensions beyond the
 * function, and carries no address (plan §2.2: a refused sign-in is a count, never a record).
 */
export const metric = (name: string, namespace = "CRV/Door"): void => {
  // The embedded metric format is a log line.
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{ Namespace: namespace, Dimensions: [[]], Metrics: [{ Name: name, Unit: "Count" }] }],
      },
      [name]: 1,
    }),
  );
};

/** An error's name, which is safe to log where its message may not be. */
export const errorName = (error: unknown): string => (error instanceof Error ? error.name : "unknown");
