/**
 * Reads Streamlane's roadmap from its own planning team as a guest, before `next build`, and leaves what it read in
 * .roadmap-snapshot.json for /streamlane/roadmap/ (lib/roadmap.ts; CRV-015). It never fails the build: whatever it
 * cannot read, it logs by part with why, and the page then says the roadmap could not be read and shows no idea.
 *
 * Which team: the one `product-facts.ts` names. Which deployment: the product's outputs in `CRV_STREAMLANE_OUTPUTS`,
 * which `scripts/deploy.ts` downloads from its own account's build artifacts for an environment that reads the roadmap
 * (`readsRoadmap` in hosting/environments.ts; prod's alone, since dev's and staging's `crv` hold no such team). Unset,
 * the build reads nothing and the page says so.
 *
 *   node apps/web/scripts/read-roadmap.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { roadmapProduct } from "../lib/product-facts.ts";
import { parseRoadmapTeam, placeOf, type RoadmapProblem, type RoadmapSnapshot, readRoadmap } from "../lib/roadmap.ts";
import { guestQuery, type ProductOutputs } from "../lib/roadmap-guest.ts";

const appDir = path.join(import.meta.dirname, "..");
const out = path.join(appDir, ".roadmap-snapshot.json");
const outputsFile = process.env.CRV_STREAMLANE_OUTPUTS?.trim() ?? "";
const page = "/streamlane/roadmap/";

const write = (snapshot: RoadmapSnapshot) => writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
const log = (problems: readonly RoadmapProblem[]) => {
  for (const { part, reason } of problems) console.warn(`Roadmap: ${part} could not be read: ${reason}.`);
};

const main = async () => {
  const { roadmap } = roadmapProduct(page);
  const team = parseRoadmapTeam(roadmap.team);
  if (!outputsFile) {
    console.log(`Roadmap: this build names no product outputs (CRV_STREAMLANE_OUTPUTS), so ${page} reads no roadmap.`);
    write({ state: "none" });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  let snapshot: RoadmapSnapshot;
  try {
    if (!existsSync(outputsFile)) throw new Error(`there are no product outputs at ${outputsFile}`);
    const outputs = JSON.parse(readFileSync(outputsFile, "utf8")) as ProductOutputs;
    const read = await readRoadmap(team, guestQuery(outputs), today);
    log(read.problems);
    snapshot = read.snapshot;
  } catch (error) {
    log([{ part: `the product's outputs`, reason: error instanceof Error ? error.message : String(error) }]);
    snapshot = { state: "unread", team: team.url, readAt: today };
  }
  if (snapshot.state === "read") {
    const { ideas, threshold } = snapshot;
    const shown = ideas.filter((idea) => placeOf(idea, threshold) !== undefined).length;
    console.log(`Roadmap: read ${ideas.length} ideas from ${team.url}; ${page} shows ${shown} of them.`);
  } else {
    console.warn(`Roadmap: ${page} says the roadmap could not be read, and shows no idea.`);
  }
  write(snapshot);
};

try {
  await main();
} catch (error) {
  // Even a mistake here leaves the page a snapshot that shows nothing rather than failing the build.
  console.warn(`Roadmap: the read stopped: ${error instanceof Error ? error.message : String(error)}.`);
  write({ state: "unread", team: "", readAt: new Date().toISOString().slice(0, 10) });
}
