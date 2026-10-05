import process from "node:process";
import { parseArgs } from "node:util";

import {
  type CheckPath,
  checkGatedHost,
  checkOtherHost,
  discover,
  type Finding,
  pathsWithoutSession,
  type SiteMarks,
} from "./leak-check/check.ts";
import { createSend } from "./leak-check/http.ts";
import { awsCli, mintSessions } from "./leak-check/session.ts";
import { hostsOf, parseTestHosts, sites } from "./leak-check/sites.ts";

/**
 * The leak check (plan Phase 3, "CRV side"; CRV-014; RULE-GATED-NO-STORE). For each locked site and each of its hosts
 * it asks for every page and asset without a session, with one minted for an existing invitee, and without one again,
 * and fails on any byte of the site given without a session, any gated answer a shared cache could keep, and any host
 * that should be refused and is not.
 *
 *   pnpm run leak-check                        every site marked locked in scripts/leak-check/sites.ts
 *   pnpm run leak-check --site driftline       that site, locked or not (after a flip, before sites.ts says so)
 *   pnpm run leak-check --test-host driftline:main.<tmp>.amplifyapp.com --only-test-hosts
 *                                              a temporary app's host only, before the live flip
 *   pnpm run leak-check --no-session           no AWS at all: the checks without a session and the host checks
 *
 * With a session it needs AWS credentials for the coral-reef project (by hand, `AWS_PROFILE=coral-reef`, and
 * `AWS_CLI` if `aws` on the path is not the one that reads its login) and an invitee an admin has already invited to
 * the checked sites from /admin/: `crv-check@example.com`, or `--invitee` / `CRV_LEAK_CHECK_INVITEE`. The check sets
 * that user a fresh password and signs in as it; it never invites, erases or creates anyone (session.ts).
 * CRV_DOOR_TEST_HOSTS adds test hosts in the backend's own format. It exits 1 on any finding and prints no secret: findings name a host, a path and a status.
 */

const { values } = parseArgs({
  options: {
    site: { type: "string", multiple: true },
    "test-host": { type: "string", multiple: true },
    "only-test-hosts": { type: "boolean", default: false },
    "no-session": { type: "boolean", default: false },
    invitee: { type: "string" },
  },
});

const testHosts = parseTestHosts([process.env.CRV_DOOR_TEST_HOSTS ?? "", ...(values["test-host"] ?? [])].join(","));
const unknown = (values.site ?? []).filter((id) => !sites.some((site) => site.id === id));
if (unknown.length > 0) {
  console.error(`No site ${unknown.join(", ")}; the sites are ${sites.map((site) => site.id).join(", ")}.`);
  process.exit(2);
}
// Named sites, or else the locked ones and any site a --test-host names (a temporary app is proved before its flip).
const named = parseTestHosts((values["test-host"] ?? []).join(",")).map((test) => test.site);
const chosen = values.site?.length
  ? sites.filter((site) => values.site?.includes(site.id))
  : sites.filter((site) => site.locked || named.includes(site.id));
if (chosen.length === 0) {
  console.log("No site is marked locked in scripts/leak-check/sites.ts, so there is nothing to check yet.");
  process.exit(0);
}

const send = createSend();
// With only test hosts, the product's own domains are not the subject (the site is still open): the temporary hosts alone.
const onlyTestHosts = values["only-test-hosts"];
const plan = chosen.map((site) => ({
  site,
  hosts: hostsOf(site, testHosts).filter(
    (checked) => !onlyTestHosts || (checked.role === "gated" && checked.host !== site.apex),
  ),
}));
const gated = plan.flatMap(({ site, hosts }) =>
  hosts.filter((checked) => checked.role === "gated").map((checked) => ({ site: site.id, host: checked.host })),
);
if (onlyTestHosts && gated.length === 0) {
  console.error("--only-test-hosts needs a test host (--test-host or CRV_DOOR_TEST_HOSTS).");
  process.exit(2);
}

const findings: Finding[] = [];
const notes: string[] = [];
let requests = 0;

try {
  let cookies = new Map<string, string>();
  if (!values["no-session"]) {
    const minted = await mintSessions({
      aws: awsCli(),
      send,
      hosts: gated,
      invitee: values.invitee || process.env.CRV_LEAK_CHECK_INVITEE,
    });
    cookies = minted.cookies;
    console.log(`Minted a session for ${gated.map((entry) => entry.host).join(", ")} as an existing invitee.`);
  }

  for (const { site, hosts } of plan) {
    const firstGated = hosts.find((checked) => checked.role === "gated");
    const cookie = firstGated ? cookies.get(firstGated.host) : undefined;
    let paths: CheckPath[] = pathsWithoutSession(site.pages);
    let marks: SiteMarks = { titles: new Set() };
    if (firstGated && cookie) {
      const found = await discover({
        send,
        host: firstGated.host,
        hosts: hosts.map((checked) => checked.host),
        cookie,
        fallback: site.pages,
      });
      ({ paths, marks } = found);
      findings.push(...found.findings);
      notes.push(...found.notes);
    }
    const reference: { template?: string } = {};
    for (const checked of hosts) {
      const result =
        checked.role === "gated"
          ? await checkGatedHost({
              send,
              host: checked.host,
              paths,
              cookie: cookies.get(checked.host),
              marks,
              reference,
            })
          : await checkOtherHost({
              send,
              checked,
              targets: [
                "/",
                ...paths
                  .filter((path) => path.page && path.target !== "/")
                  .slice(0, 1)
                  .map((p) => p.target),
              ],
              cookie: firstGated ? cookies.get(firstGated.host) : undefined,
              marks,
            });
      findings.push(...result.findings);
      requests += result.requests;
      const own = result.findings.filter((finding) => finding.host === checked.host).length;
      console.log(
        `${checked.host} (${checked.role}): ${result.requests} requests, ${own === 0 ? "clean" : `${own} findings`}`,
      );
    }
    console.log(`${site.id}: ${paths.length} paths${cookie ? "" : ", without a session"}.`);
  }
} catch (error) {
  findings.push({
    host: "-",
    target: "-",
    step: "running the check",
    problem: error instanceof Error ? error.message : "failed",
  });
}

for (const note of notes) console.log(`Note: ${note}`);
if (findings.length > 0) {
  console.error(`\n${findings.length} findings over ${requests} requests:`);
  for (const finding of findings) {
    console.error(
      `- ${finding.host}${finding.target === "-" ? "" : finding.target} (${finding.step}): ${finding.problem}`,
    );
  }
  process.exit(1);
}
console.log(`\nClean: ${requests} requests, no byte of a locked site without a session.`);
