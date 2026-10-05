/**
 * Every function and trigger logs JSON and keeps it a month (plan §2.3a). Without a retention, a log group never
 * expires, and the privacy page says logs are deleted after 1 month.
 */
export const functionLogging = { format: "json", retention: "1 month" } as const;
