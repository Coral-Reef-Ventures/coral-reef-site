import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseSnapshot, type RoadmapSnapshot } from "./roadmap.ts";

/**
 * Where `scripts/read-roadmap.ts` leaves what it read, before `next build`, for /streamlane/roadmap/ to render: the
 * app's own directory, where the build runs, or the repository root under the tests. Ignored by Git.
 * `CRV_ROADMAP_SNAPSHOT` names another file, which the screen tests use for their stubbed roadmap.
 */
const appDir = existsSync(join(process.cwd(), "content")) ? process.cwd() : join(process.cwd(), "apps", "web");
export const snapshotPath = (): string => process.env.CRV_ROADMAP_SNAPSHOT || join(appDir, ".roadmap-snapshot.json");

/**
 * What the build read. No file (a `next dev` without the script, say) reads as a build that asked for no roadmap; a
 * file that cannot be parsed reads as a read that failed, so the page never shows an idea it was not given.
 */
export const loadRoadmapSnapshot = (file = snapshotPath()): RoadmapSnapshot => {
  if (!existsSync(file)) return { state: "none" };
  try {
    return parseSnapshot(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return { state: "unread", team: "", readAt: "" };
  }
};
