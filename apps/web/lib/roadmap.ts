/**
 * Streamlane's roadmap at /streamlane/roadmap/ (CRV-015): its own planning team, `SL` in `crv`, read at build as a
 * signed-out guest reads a public team (Streamlane ADR 0094), and laid out as the product's roadmap lays it out
 * (Streamlane's `packages/core/src/views/roadmap.ts`, with a team roadmap's defaults: a month a step, no pebbles below
 * the team's threshold unless shown on purpose, no delivered ideas). Nothing runs in the browser.
 *
 * This module is the mapping and the layout, with the read handed in (`GuestQuery`), so the tests stub it;
 * `roadmap-guest.ts` is the read itself, `scripts/read-roadmap.ts` runs both before `next build`, and
 * `roadmap-snapshot.ts` reads what it left for the page. The team's address is a product fact (`product-facts.ts`).
 */

/** The team the page reads and links: its organization's address, that address's slug, and the team's key. */
export type RoadmapTeam = {
  /** The organization's address in the product, `https://crv.streamlane.app`. */
  origin: string;
  /** The organization's slug, the first label of its address. */
  slug: string;
  teamKey: string;
  /** The team's address, `https://crv.streamlane.app/teams/SL`. */
  url: string;
};

export type Horizon = "now" | "next" | "later";
export type Size = "pebble" | "rock" | "boulder";
export type RoadmapThreshold = Size;
/** A target period as stored: its first and last day. */
export type Period = { start: string; end: string };

/** One idea as a guest reads it, and as the snapshot keeps it. */
export type RoadmapIdea = {
  /** `SL-112`: its page in the product is the organization's address and this. */
  key: string;
  title: string;
  /** Its stage as the idea workflow stores it (`committed`); `ideaStages` names it. */
  stage: string;
  horizon?: Horizon;
  size?: Size;
  period?: Period;
  /** The goal it serves, by name, where the goal could be read. */
  goal?: string;
  showOnRoadmap: boolean;
  insights: number;
  /** How many people added its insights; absent where the idea's own page could not be read. */
  people?: number;
};

/**
 * What the build read, which the page renders: nothing asked for (`none`: a build that names no team, as dev's and
 * staging's do), a read that failed (`unread`: the page says so and shows no idea), or the team's ideas (`read`).
 */
export type RoadmapSnapshot =
  | { state: "none" }
  | { state: "unread"; team: string; readAt: string }
  | { state: "read"; team: string; readAt: string; threshold: RoadmapThreshold; ideas: RoadmapIdea[] };

/** What could not be read, and why, for the build's log. */
export type RoadmapProblem = { part: string; reason: string };

/**
 * One GraphQL query, signed as the identity pool's guest: the response's `data`, or a thrown error carrying the API's
 * message (a refusal, a network failure, a timeout).
 */
export type GuestQuery = (query: string, variables: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** `https://<slug>.<base domain>/teams/<KEY>`, the team's own address in the product. */
export const parseRoadmapTeam = (address: string): RoadmapTeam => {
  const url = new URL(address);
  const match = /^\/teams\/([A-Z][A-Z0-9]*)\/?$/.exec(url.pathname);
  if (url.protocol !== "https:" || !match || url.search || url.hash) {
    throw new Error(`"${address}" is not a team's address, https://<organization>/teams/<KEY>`);
  }
  const teamKey = match[1] ?? "";
  return { origin: url.origin, slug: url.hostname.split(".")[0] ?? "", teamKey, url: `${url.origin}/teams/${teamKey}` };
};

/** An idea's page in the product, where "Add my insight" asks a guest to sign in with Google first. */
export const ideaUrl = (team: Pick<RoadmapTeam, "origin">, key: string) => `${team.origin}/${key}`;

/** The team's ideas in the product, every one a visitor may read, where Roadmap is one of the list's layouts. */
export const teamIdeasUrl = (team: Pick<RoadmapTeam, "url">) => `${team.url}/ideas`;

/** The stages an idea moves through, by name, as the product's idea workflow names them. */
export const ideaStages: Readonly<Record<string, string>> = {
  inbox: "Inbox",
  triaged: "Triaged",
  exploring: "Exploring",
  validated: "Validated",
  committed: "Committed",
  inDelivery: "In delivery",
  delivered: "Delivered",
  parked: "Parked",
  declined: "Declined",
};

export const horizonNames: Readonly<Record<Horizon, string>> = { now: "Now", next: "Next", later: "Later" };
export const sizeNames: Readonly<Record<Size, string>> = { pebble: "Pebble", rock: "Rock", boulder: "Boulder" };
const horizons = Object.keys(horizonNames) as Horizon[];
const sizes = Object.keys(sizeNames) as Size[];

/** The stages a dated idea is in, on the timeline. */
const datedStages = ["committed", "inDelivery"];
/** The stages an idea waits in before it is committed, soonest to commit first. */
const waitingStages = ["validated", "exploring", "triaged"];

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** AWSJSON comes back as a JSON string; a test's stub may hand back the object itself. */
const jsonObject = (value: unknown): Record<string, unknown> => {
  try {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const count = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;

const dayPattern = /^\d{4}-\d{2}-\d{2}/;

/** A target period as stored, its first and last day, or undefined where it is not one. */
export const periodOf = (value: unknown): Period | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const { start, end } = value as Record<string, unknown>;
  if (typeof start !== "string" || typeof end !== "string" || !dayPattern.test(start) || !dayPattern.test(end)) return;
  const period = { start: start.slice(0, 10), end: end.slice(0, 10) };
  return !Number.isNaN(Date.parse(period.start)) && period.start <= period.end ? period : undefined;
};

const keyPattern = /^[A-Z][A-Z0-9]*-\d+$/;

/** One idea of the team's list as a guest reads it, or why it cannot be shown. */
export const toRoadmapIdea = (node: unknown): RoadmapIdea | string => {
  if (!node || typeof node !== "object") return "it is not an item";
  const fields = node as Record<string, unknown>;
  const key = typeof fields.key === "string" && keyPattern.test(fields.key) ? fields.key : undefined;
  if (!key) return `it has no key the page can link (${JSON.stringify(fields.key)})`;
  if (fields.type !== "idea") return `${key} is a ${String(fields.type)}, not an idea`;
  if (fields.deletedAt) return `${key} is in the trash`;
  const properties = jsonObject(fields.properties);
  const title = typeof properties.title === "string" ? properties.title.trim() : "";
  if (!title) return `${key} has no title`;
  const stage = typeof fields.status === "string" ? fields.status : properties.status;
  if (typeof stage !== "string" || !(stage in ideaStages)) {
    return `${key}'s stage ${JSON.stringify(stage)} is not one the page names`;
  }
  const insights = count(jsonObject(fields.computed).insightCount ?? 0);
  if (insights === undefined) return `${key}'s insight count is not a whole number`;
  const idea: RoadmapIdea = { key, title, stage, showOnRoadmap: properties.showOnRoadmap === true, insights };
  if (oneOf(horizons, properties.horizon)) idea.horizon = properties.horizon;
  if (oneOf(sizes, properties.size)) idea.size = properties.size;
  const period = periodOf(properties.targetPeriod);
  if (period) idea.period = period;
  return idea;
};

const sizeRank: Record<Size, number> = { pebble: 0, rock: 1, boulder: 2 };

/** A team's threshold as stored, or the product's default, Rock, for a team that never set one. */
export const thresholdOf = (value: unknown): RoadmapThreshold => (oneOf(sizes, value) ? value : "rock");

/**
 * Whether an idea is big enough for the roadmap: at or above the team's threshold, shown on purpose (Show on roadmap),
 * or not sized at all, since nothing says it is small. Pebbles below the threshold stay off, as a team roadmap's
 * default view has them.
 */
export const bigEnough = (idea: RoadmapIdea, threshold: RoadmapThreshold): boolean =>
  idea.showOnRoadmap || idea.size === undefined || sizeRank[idea.size] >= sizeRank[threshold];

/**
 * Where the page puts an idea: on the timeline when it is committed or in delivery (`dated`), among the ideas not yet
 * committed when it is triaged, exploring or validated (`waiting`), and nowhere otherwise: an idea still in the inbox,
 * delivered, parked or declined, or a committed one below the threshold. The product puts a waiting idea on its
 * roadmap only with a horizon; the page shows the rest too, by stage, so a reader sees every idea the team is weighing.
 */
export const placeOf = (idea: RoadmapIdea, threshold: RoadmapThreshold): "dated" | "waiting" | undefined => {
  if (!bigEnough(idea, threshold)) return;
  if (datedStages.includes(idea.stage)) return "dated";
  if (waitingStages.includes(idea.stage)) return "waiting";
  return;
};

const organizationQuery = /* GraphQL */ `
  query Organization($slug: String!) {
    organizationBySlug(slug: $slug) {
      orgId
    }
  }
`;

const teamsQuery = /* GraphQL */ `
  query Teams($orgId: ID!) {
    listTeams(orgId: $orgId) {
      teamKey
      roadmapThreshold
    }
  }
`;

const ideasQuery = /* GraphQL */ `
  query Ideas($orgId: ID!, $teamKey: String!, $type: String!, $limit: Int, $nextToken: String) {
    listTeamNodes(orgId: $orgId, teamKey: $teamKey, type: $type, statusCategory: null, limit: $limit, nextToken: $nextToken) {
      items {
        id
        key
        type
        status
        properties
        computed
        goalId
        deletedAt
      }
      nextToken
    }
  }
`;

const nodeQuery = /* GraphQL */ `
  query Node($orgId: ID!, $id: ID!) {
    nodeById(orgId: $orgId, id: $id) {
      key
      type
      properties
      computed
      deletedAt
    }
  }
`;

/** At most this many pages of ideas, so a list that never ends cannot hold the build. */
const maxPages = 20;
/** How many of the ideas' own pages are read at once. */
const parallelReads = 4;

/** Runs `work` over `items`, `limit` at a time, in order. */
const inBatches = async <T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>) => {
  for (let at = 0; at < items.length; at += limit) {
    await Promise.all(items.slice(at, at + limit).map(work));
  }
};

/**
 * Reads the team's live ideas as a guest, their goals by name, and, for each idea the page shows, how many people
 * added its insights, which only an idea's own page gives. Never throws. The organization, the team or the list not
 * readable means nothing is shown (`unread`); a goal or a people count not readable leaves just that out. Each problem
 * comes back with what it was about and why, for the build's log.
 */
export const readRoadmap = async (
  team: RoadmapTeam,
  query: GuestQuery,
  today: string,
): Promise<{ snapshot: RoadmapSnapshot; problems: RoadmapProblem[] }> => {
  const problems: RoadmapProblem[] = [];
  const unread = (part: string, reason: string) => ({
    snapshot: { state: "unread" as const, team: team.url, readAt: today },
    problems: [...problems, { part, reason }],
  });

  let orgId: string;
  try {
    const organization = (await query(organizationQuery, { slug: team.slug })).organizationBySlug;
    const id = organization && typeof organization === "object" ? (organization as { orgId?: unknown }).orgId : null;
    if (typeof id !== "string" || !id) {
      return unread(`the organization ${team.origin}`, "it has no public team, so a guest reads nothing there");
    }
    orgId = id;
  } catch (error) {
    return unread(`the organization ${team.origin}`, messageOf(error));
  }

  let threshold: RoadmapThreshold;
  try {
    const teams = (await query(teamsQuery, { orgId })).listTeams;
    const listed = Array.isArray(teams)
      ? (teams as { teamKey?: unknown; roadmapThreshold?: unknown }[]).find((entry) => entry?.teamKey === team.teamKey)
      : undefined;
    if (!listed) return unread(`the team ${team.url}`, "it is not public");
    threshold = thresholdOf(listed.roadmapThreshold);
  } catch (error) {
    return unread(`the team ${team.url}`, messageOf(error));
  }

  const ideas: RoadmapIdea[] = [];
  const goalOf = new Map<string, string>();
  const idOf = new Map<string, string>();
  try {
    let nextToken: string | null = null;
    let pages = 0;
    do {
      const page = (await query(ideasQuery, { orgId, teamKey: team.teamKey, type: "idea", limit: 100, nextToken }))
        .listTeamNodes as { items?: unknown; nextToken?: unknown } | null | undefined;
      if (!page || !Array.isArray(page.items)) throw new Error("the API answered with no list");
      for (const node of page.items) {
        const idea = toRoadmapIdea(node);
        if (typeof idea === "string") {
          problems.push({ part: "an idea", reason: idea });
          continue;
        }
        ideas.push(idea);
        const { id, goalId } = node as { id?: unknown; goalId?: unknown };
        if (typeof id === "string" && id) idOf.set(idea.key, id);
        if (typeof goalId === "string" && goalId) goalOf.set(idea.key, goalId);
      }
      nextToken = typeof page.nextToken === "string" && page.nextToken ? page.nextToken : null;
      pages += 1;
      if (nextToken && pages >= maxPages) throw new Error(`the list ran past ${maxPages} pages`);
    } while (nextToken);
  } catch (error) {
    return unread(`the ideas of ${team.url}`, messageOf(error));
  }

  const goalNames = new Map<string, string>();
  await inBatches([...new Set(goalOf.values())], parallelReads, async (id) => {
    try {
      const goal = (await query(nodeQuery, { orgId, id })).nodeById as { type?: unknown; properties?: unknown } | null;
      const title = jsonObject(goal?.properties).title;
      if (goal?.type === "goal" && typeof title === "string" && title.trim()) {
        goalNames.set(id, title.trim());
      } else {
        problems.push({ part: `the goal ${id}`, reason: "it is not a goal a guest may read" });
      }
    } catch (error) {
      problems.push({ part: `the goal ${id}`, reason: messageOf(error) });
    }
  });

  const shown = ideas.filter((idea) => placeOf(idea, threshold) !== undefined);
  await inBatches(shown, parallelReads, async (idea) => {
    try {
      const id = idOf.get(idea.key);
      if (!id) throw new Error("the list gave it no id");
      const node = (await query(nodeQuery, { orgId, id })).nodeById;
      const people = count(jsonObject((node as { computed?: unknown } | null)?.computed).insightPeople);
      if (people === undefined) {
        problems.push({ part: `${idea.key}'s people`, reason: "its page gave no count of people" });
      } else {
        idea.people = people;
      }
    } catch (error) {
      problems.push({ part: `${idea.key}'s people`, reason: messageOf(error) });
    }
  });

  for (const idea of ideas) {
    const goal = goalNames.get(goalOf.get(idea.key) ?? "");
    if (goal) idea.goal = goal;
  }
  return { snapshot: { state: "read", team: team.url, readAt: today, threshold, ideas }, problems };
};

/** A snapshot as read back from its file: anything malformed reads as a failed read, never as ideas. */
export const parseSnapshot = (raw: unknown): RoadmapSnapshot => {
  const fields = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (fields.state === "none") return { state: "none" };
  let team = "";
  try {
    team = parseRoadmapTeam(String(fields.team)).url;
  } catch {
    // Left empty: the page links the team from the product facts, whatever the file says.
  }
  const readAt = typeof fields.readAt === "string" && dayPattern.test(fields.readAt) ? fields.readAt.slice(0, 10) : "";
  if (fields.state !== "read" || !Array.isArray(fields.ideas) || !readAt || !team) {
    return { state: "unread", team, readAt };
  }
  const ideas: RoadmapIdea[] = [];
  for (const entry of fields.ideas as Record<string, unknown>[]) {
    const idea = toRoadmapIdea({
      key: entry?.key,
      type: "idea",
      status: entry?.stage,
      properties: {
        title: entry?.title,
        horizon: entry?.horizon,
        size: entry?.size,
        targetPeriod: entry?.period,
        showOnRoadmap: entry?.showOnRoadmap,
      },
      computed: { insightCount: entry?.insights },
    });
    if (typeof idea === "string") continue;
    const people = count(entry.people);
    if (people !== undefined) idea.people = people;
    if (typeof entry.goal === "string" && entry.goal) idea.goal = entry.goal;
    ideas.push(idea);
  }
  return { state: "read", team, readAt, threshold: thresholdOf(fields.threshold), ideas };
};

// ---- the layout ----------------------------------------------------------------------------------------------------

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fullMonthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Months since year 0 of a date or a month ("2026-10-15" or "2026-10"). */
const monthNumber = (date: string): number => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthStart = (month: number): string =>
  `${String(Math.floor(month / 12)).padStart(4, "0")}-${String((month % 12) + 1).padStart(2, "0")}-01`;
const dayMs = 24 * 60 * 60 * 1000;
const dayNumber = (date: string): number =>
  Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / dayMs;
const dayAfter = (date: string): string => new Date((dayNumber(date) + 1) * dayMs).toISOString().slice(0, 10);
const lastDayOfMonth = (date: string) => dayAfter(date).slice(8, 10) === "01";

/** A day as the page writes it: "Oct 17, 2026", as the product does. */
export const dayText = (date: string) =>
  `${monthNames[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;

/** The day the roadmap was read, in words: "17 October 2026". */
export const readDayText = (date: string) =>
  `${Number(date.slice(8, 10))} ${fullMonthNames[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/**
 * A target period as people say it, as the product writes it: "Mar 2027" for a month, "Q1 2027" for a calendar
 * quarter, and otherwise its two days ("Oct 16 – Nov 6, 2026").
 */
export const periodText = ({ start, end }: Period): string => {
  const startMonth = Number(start.slice(5, 7)) - 1;
  const wholeMonths = start.slice(8, 10) === "01" && lastDayOfMonth(end);
  const months = monthNumber(end) - monthNumber(start) + 1;
  if (wholeMonths && months === 1) return `${monthNames[startMonth]} ${start.slice(0, 4)}`;
  if (wholeMonths && months === 3 && startMonth % 3 === 0) return `Q${startMonth / 3 + 1} ${start.slice(0, 4)}`;
  const day = (date: string) => `${monthNames[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${day(start)} – ${dayText(end)}`
    : `${dayText(start)} – ${dayText(end)}`;
};

/** The dates the timeline spans: from the first of a month up to, not including, the first of a later one. */
export type RoadmapWindow = { from: string; to: string };

/** The fewest months a timeline shows, so one with a single bar still reads as a timeline. */
const fewestMonths = 6;

/** Every bar and today, widened to whole months and to at least six of them, as the product's month scale does. */
export const roadmapWindow = (periods: readonly Period[], today: string): RoadmapWindow => {
  const first = Math.min(...[today, ...periods.map((period) => period.start)].map(monthNumber));
  const last = Math.max(...[today, ...periods.map((period) => period.end)].map(monthNumber));
  return { from: monthStart(first), to: monthStart(Math.max(last + 1, first + fewestMonths)) };
};

/** Where a date falls across the window, from 0 at its start to 1 at its end. */
const positionIn = (window: RoadmapWindow, date: string): number =>
  (dayNumber(date) - dayNumber(window.from)) / (dayNumber(window.to) - dayNumber(window.from));

/** One month of the timeline's header: what it says ("Oct 2026", "Nov", "Jan 2027") and where it starts. */
export type RoadmapTick = { label: string; at: number };

/** The window's months. A month names its year on the first one and in January. */
export const roadmapTicks = (window: RoadmapWindow): RoadmapTick[] => {
  const ticks: RoadmapTick[] = [];
  for (let month = monthNumber(window.from); month < monthNumber(window.to); month += 1) {
    const year = Math.floor(month / 12);
    const label = `${monthNames[month % 12]}${ticks.length === 0 || month % 12 === 0 ? ` ${year}` : ""}`;
    ticks.push({ label, at: positionIn(window, monthStart(month)) });
  }
  return ticks;
};

/** Where a period's bar sits across the window, from 0 to 1, cut at the window's edges. */
export const barSpan = (window: RoadmapWindow, period: Period): { from: number; to: number } => ({
  from: Math.max(0, positionIn(window, period.start)),
  to: Math.min(1, positionIn(window, dayAfter(period.end))),
});

/** A group of ideas under one name: a target period's, a horizon's or a stage's. */
export type IdeaGroup = { name: string; ideas: RoadmapIdea[] };

export type RoadmapLayout = {
  /** The committed ideas with a target period, one group a period, earliest first; absent when none has one. */
  timeline?: {
    ticks: RoadmapTick[];
    periods: (IdeaGroup & { span: { from: number; to: number } })[];
  };
  /** Committed ideas with no target period yet. */
  undated: RoadmapIdea[];
  /** The ideas not yet committed: by horizon (Now, Next, Later) when any has one, and otherwise by stage. */
  waiting: { by: "horizon" | "stage"; groups: IdeaGroup[] };
};

/**
 * The read ideas laid out as the page shows them. Within a group the ideas keep the team's own order, the order its
 * list gives them in.
 */
export const roadmapLayout = (ideas: readonly RoadmapIdea[], threshold: RoadmapThreshold, today: string) => {
  const dated = ideas.filter((idea) => placeOf(idea, threshold) === "dated");
  const waiting = ideas.filter((idea) => placeOf(idea, threshold) === "waiting");

  const byPeriod = new Map<string, { period: Period; ideas: RoadmapIdea[] }>();
  for (const idea of dated) {
    if (!idea.period) continue;
    const id = `${idea.period.start}/${idea.period.end}`;
    const group = byPeriod.get(id) ?? { period: idea.period, ideas: [] };
    group.ideas.push(idea);
    byPeriod.set(id, group);
  }
  const groups = [...byPeriod.values()].sort(
    (a, b) => a.period.start.localeCompare(b.period.start) || a.period.end.localeCompare(b.period.end),
  );
  const window = roadmapWindow(
    groups.map((group) => group.period),
    today,
  );
  const layout: RoadmapLayout = {
    undated: dated.filter((idea) => !idea.period),
    waiting: { by: "stage", groups: [] },
  };
  if (groups.length > 0) {
    layout.timeline = {
      ticks: roadmapTicks(window),
      periods: groups.map((group) => ({
        name: periodText(group.period),
        ideas: group.ideas,
        span: barSpan(window, group.period),
      })),
    };
  }

  const named = (name: string, list: RoadmapIdea[]): IdeaGroup[] => (list.length > 0 ? [{ name, ideas: list }] : []);
  if (waiting.some((idea) => idea.horizon)) {
    layout.waiting = {
      by: "horizon",
      groups: [
        ...horizons.flatMap((horizon) =>
          named(
            horizonNames[horizon],
            waiting.filter((idea) => idea.horizon === horizon),
          ),
        ),
        ...named(
          "No horizon yet",
          waiting.filter((idea) => !idea.horizon),
        ),
      ],
    };
  } else {
    layout.waiting = {
      by: "stage",
      groups: waitingStages.flatMap((stage) =>
        named(
          ideaStages[stage] ?? stage,
          waiting.filter((idea) => idea.stage === stage),
        ),
      ),
    };
  }
  return layout;
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "9 insights from 4 people", or "9 insights" where the people could not be counted. */
export const countsText = (idea: Pick<RoadmapIdea, "insights" | "people">) =>
  `${plural(idea.insights, "insight", "insights")}${
    idea.people === undefined ? "" : ` from ${plural(idea.people, "person", "people")}`
  }`;
