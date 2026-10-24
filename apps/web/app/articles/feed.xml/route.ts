import { articlesFeed } from "../../../lib/feed.ts";

export const dynamic = "force-static";

/** The articles as RSS 2.0, written at build (CRV-016): a reader follows them with no account and nothing tracked. */
export function GET(): Response {
  return new Response(articlesFeed(), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
