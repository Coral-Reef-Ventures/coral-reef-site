import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { doorProductGrid } from "./products.ts";
import { PRODUCTS, roadmapProduct } from "./product-facts.ts";
import {
  countsText,
  type GuestQuery,
  parseRoadmapTeam,
  parseSnapshot,
  periodText,
  placeOf,
  type RoadmapIdea,
  type RoadmapSnapshot,
  readRoadmap,
  roadmapLayout,
  roadmapTicks,
  roadmapWindow,
  toRoadmapIdea,
} from "./roadmap.ts";
import { StreamlaneRoadmap } from "./roadmap-view.tsx";

const team = parseRoadmapTeam("https://crv.streamlane.app/teams/SL");
const today = "2026-10-17";

/** One idea as the team's list gives it to a guest: AWSJSON strings, as the API sends them. */
const node = (key: string, properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: `id-${key}`,
  key,
  type: "idea",
  status: properties.status,
  properties: JSON.stringify({ title: `Idea ${key}`, ...properties }),
  computed: JSON.stringify({ insightCount: 2 }),
  goalId: "goal-1",
  deletedAt: null,
  ...extra,
});

const committed = { status: "committed", size: "rock", targetPeriod: { start: "2026-10-16", end: "2026-11-06" } };

/** A stubbed guest read: the organization, the team, one page of ideas, and each node by id. */
const stub = (
  ideas: unknown[],
  over: Partial<Record<string, (variables: Record<string, unknown>) => unknown>> = {},
) => {
  const calls: string[] = [];
  const query: GuestQuery = async (text, variables) => {
    const name = /\b(organizationBySlug|listTeams|listTeamNodes|nodeById)\b/.exec(text)?.[1] ?? "?";
    calls.push(name);
    const answer = over[name]?.(variables);
    if (answer instanceof Error) throw answer;
    if (answer !== undefined) return { [name]: answer };
    if (name === "organizationBySlug") return { organizationBySlug: { orgId: "org-1" } };
    if (name === "listTeams") return { listTeams: [{ teamKey: "SL", roadmapThreshold: "rock" }] };
    if (name === "listTeamNodes") return { listTeamNodes: { items: ideas, nextToken: null } };
    if (variables.id === "goal-1") {
      return { nodeById: { type: "goal", properties: JSON.stringify({ title: "Leave Atlassian" }) } };
    }
    return { nodeById: { type: "idea", computed: JSON.stringify({ insightCount: 2, insightPeople: 1 }) } };
  };
  return { query, calls };
};

describe("CRV-015: reading Streamlane's roadmap as a guest", () => {
  it("reads the team's ideas, their goals by name and each shown idea's people", async () => {
    const { query } = stub([node("SL-1", committed), node("SL-2", { status: "inbox" })]);
    const { snapshot, problems } = await readRoadmap(team, query, today);
    expect(problems).toEqual([]);
    expect(snapshot).toEqual({
      state: "read",
      team: "https://crv.streamlane.app/teams/SL",
      readAt: today,
      threshold: "rock",
      ideas: [
        {
          key: "SL-1",
          title: "Idea SL-1",
          stage: "committed",
          size: "rock",
          period: { start: "2026-10-16", end: "2026-11-06" },
          showOnRoadmap: false,
          insights: 2,
          people: 1,
          goal: "Leave Atlassian",
        },
        // An inbox idea is not shown, so its people are not read.
        { key: "SL-2", title: "Idea SL-2", stage: "inbox", showOnRoadmap: false, insights: 2, goal: "Leave Atlassian" },
      ],
    });
  });

  it.each([
    ["organizationBySlug", null, "the organization https://crv.streamlane.app", "it has no public team"],
    ["listTeams", [{ teamKey: "OTHER" }], "the team https://crv.streamlane.app/teams/SL", "it is not public"],
    ["listTeamNodes", new Error("the API answered 401: Unauthorized"), "the ideas of", "the API answered 401"],
    ["organizationBySlug", new Error("fetch failed"), "the organization", "fetch failed"],
  ])("shows nothing when %s fails, and says which part and why", async (operation, answer, part, reason) => {
    const { query } = stub([node("SL-1", committed)], { [operation]: () => answer });
    const { snapshot, problems } = await readRoadmap(team, query, today);
    expect(snapshot).toEqual({ state: "unread", team: team.url, readAt: today });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.part).toContain(part);
    expect(problems[0]?.reason).toContain(reason);
  });

  it("keeps an idea whose people or goal cannot be read, without them, and logs each", async () => {
    const { query } = stub([node("SL-1", committed)], {
      nodeById: () => new Error("timed out"),
    });
    const { snapshot, problems } = await readRoadmap(team, query, today);
    expect(snapshot.state).toBe("read");
    const [idea] = snapshot.state === "read" ? snapshot.ideas : [];
    expect(idea?.people).toBeUndefined();
    expect(idea?.goal).toBeUndefined();
    expect(problems.map((p) => p.part)).toEqual(["the goal goal-1", "SL-1's people"]);
  });

  it("leaves out what is not a live idea it can name, and says why", () => {
    expect(toRoadmapIdea(node("SL-1", committed, { deletedAt: "2026-10-01T00:00:00Z" }))).toBe("SL-1 is in the trash");
    expect(toRoadmapIdea(node("SL-1", { status: "somewhere" }))).toMatch(/not one the page names/);
    expect(toRoadmapIdea(node("SL-1", { status: "triaged", title: " " }))).toBe("SL-1 has no title");
    expect(toRoadmapIdea(node("SL-1", committed, { type: "task" }))).toBe("SL-1 is a task, not an idea");
    expect(toRoadmapIdea({ ...node("x", committed), key: "x" })).toMatch(/no key/);
  });

  it("reads a malformed or partial snapshot as a read that failed, never as ideas", () => {
    expect(parseSnapshot(undefined)).toEqual({ state: "unread", team: "", readAt: "" });
    expect(parseSnapshot({ state: "none" })).toEqual({ state: "none" });
    expect(parseSnapshot({ state: "read", team: team.url, readAt: today })).toEqual({
      state: "unread",
      team: team.url,
      readAt: today,
    });
    const read = parseSnapshot({
      state: "read",
      team: team.url,
      readAt: today,
      threshold: "boulder",
      ideas: [{ key: "SL-1", title: "One", stage: "triaged", insights: 3, people: 2 }, { key: "bad" }],
    });
    expect(read).toEqual({
      state: "read",
      team: team.url,
      readAt: today,
      threshold: "boulder",
      ideas: [{ key: "SL-1", title: "One", stage: "triaged", showOnRoadmap: false, insights: 3, people: 2 }],
    });
  });
});

const idea = (key: string, over: Partial<RoadmapIdea>): RoadmapIdea => ({
  key,
  title: `Idea ${key}`,
  stage: "committed",
  showOnRoadmap: false,
  insights: 0,
  ...over,
});

describe("CRV-015: laying Streamlane's roadmap out as the product does", () => {
  it("puts committed and in-delivery ideas on the timeline, and leaves inbox, delivered, parked and declined off", () => {
    for (const stage of ["committed", "inDelivery"]) expect(placeOf(idea("SL-1", { stage }), "rock")).toBe("dated");
    for (const stage of ["triaged", "exploring", "validated"]) {
      expect(placeOf(idea("SL-1", { stage }), "rock")).toBe("waiting");
    }
    for (const stage of ["inbox", "delivered", "parked", "declined"]) {
      expect(placeOf(idea("SL-1", { stage }), "rock")).toBeUndefined();
    }
  });

  it("keeps a pebble below the threshold off, unless it is shown on purpose or unsized", () => {
    expect(placeOf(idea("SL-1", { size: "pebble" }), "rock")).toBeUndefined();
    expect(placeOf(idea("SL-1", { size: "pebble", showOnRoadmap: true }), "rock")).toBe("dated");
    expect(placeOf(idea("SL-1", {}), "boulder")).toBe("dated");
    expect(placeOf(idea("SL-1", { size: "rock" }), "boulder")).toBeUndefined();
  });

  it("groups the timeline by target period, earliest first, in the team's own order within each", () => {
    const later = { start: "2027-01-04", end: "2027-02-05" };
    const sooner = { start: "2026-10-16", end: "2026-11-06" };
    const layout = roadmapLayout(
      [
        idea("SL-3", { period: later }),
        idea("SL-1", { period: sooner }),
        idea("SL-2", { period: later }),
        idea("SL-4", {}),
      ],
      "rock",
      today,
    );
    expect(layout.timeline?.periods.map((p) => [p.name, p.ideas.map((i) => i.key)])).toEqual([
      ["Oct 16 – Nov 6, 2026", ["SL-1"]],
      ["Jan 4 – Feb 5, 2027", ["SL-3", "SL-2"]],
    ]);
    expect(layout.undated.map((i) => i.key)).toEqual(["SL-4"]);
    const [first, second] = layout.timeline?.periods ?? [];
    expect(first?.span.from).toBeGreaterThan(0);
    expect(second?.span.from).toBeGreaterThan(first?.span.to ?? 1);
    expect(second?.span.to).toBeLessThanOrEqual(1);
  });

  it("shows no timeline when no committed idea has a target period", () => {
    expect(roadmapLayout([idea("SL-1", {})], "rock", today).timeline).toBeUndefined();
  });

  it("groups the ideas not yet committed by horizon when any has one, and the rest after", () => {
    const layout = roadmapLayout(
      [
        idea("SL-1", { stage: "triaged", horizon: "later" }),
        idea("SL-2", { stage: "validated", horizon: "now" }),
        idea("SL-3", { stage: "exploring" }),
      ],
      "rock",
      today,
    );
    expect(layout.waiting.by).toBe("horizon");
    expect(layout.waiting.groups.map((g) => [g.name, g.ideas.map((i) => i.key)])).toEqual([
      ["Now", ["SL-2"]],
      ["Later", ["SL-1"]],
      ["No horizon yet", ["SL-3"]],
    ]);
  });

  it("groups them by stage, nearest to committed first, where none has a horizon", () => {
    const layout = roadmapLayout(
      [idea("SL-1", { stage: "triaged" }), idea("SL-2", { stage: "validated" }), idea("SL-3", { stage: "triaged" })],
      "rock",
      today,
    );
    expect(layout.waiting.by).toBe("stage");
    expect(layout.waiting.groups.map((g) => [g.name, g.ideas.map((i) => i.key)])).toEqual([
      ["Validated", ["SL-2"]],
      ["Triaged", ["SL-1", "SL-3"]],
    ]);
  });

  it("spans every bar and today in whole months, at least six of them, naming the year on the first and in January", () => {
    const window = roadmapWindow([{ start: "2026-11-09", end: "2027-01-15" }], today);
    expect(window).toEqual({ from: "2026-10-01", to: "2027-04-01" });
    expect(roadmapTicks(window).map((t) => t.label)).toEqual(["Oct 2026", "Nov", "Dec", "Jan 2027", "Feb", "Mar"]);
  });

  it("names a period as the product does", () => {
    expect(periodText({ start: "2027-03-01", end: "2027-03-31" })).toBe("Mar 2027");
    expect(periodText({ start: "2027-01-01", end: "2027-03-31" })).toBe("Q1 2027");
    expect(periodText({ start: "2026-11-09", end: "2027-02-05" })).toBe("Nov 9, 2026 – Feb 5, 2027");
  });

  it("counts insights and the people who added them", () => {
    expect(countsText({ insights: 9, people: 4 })).toBe("9 insights from 4 people");
    expect(countsText({ insights: 1, people: 1 })).toBe("1 insight from 1 person");
    expect(countsText({ insights: 0 })).toBe("0 insights");
  });
});

const render = (snapshot: RoadmapSnapshot) =>
  renderToStaticMarkup(<StreamlaneRoadmap snapshot={snapshot} team={team.url} />).replaceAll("&#x27;", "'");

describe("CRV-015: the roadmap page", () => {
  const read: RoadmapSnapshot = {
    state: "read",
    team: team.url,
    readAt: today,
    threshold: "rock",
    ideas: [
      idea("SL-1", {
        period: { start: "2026-10-16", end: "2026-11-06" },
        insights: 3,
        people: 2,
        goal: "Leave Atlassian",
      }),
      idea("SL-2", { stage: "triaged", size: "rock" }),
      idea("SL-3", { stage: "inbox" }),
    ],
  };

  it("shows each idea's stage and counts, and links it to its page in the product, never to streamlane.app", () => {
    const html = render(read);
    expect(html).toContain("Oct 16 – Nov 6, 2026");
    expect(html).toContain("3 insights from 2 people");
    expect(html).toContain("Committed");
    expect(html).toContain("Triaged · Rock");
    expect(html).toContain("Leave Atlassian");
    expect(html).toContain("Read from");
    expect(html).toContain("17 October 2026");
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual([
      "https://crv.streamlane.app/teams/SL",
      "https://crv.streamlane.app/SL-1",
      "https://crv.streamlane.app/SL-2",
    ]);
    expect(html).toContain('aria-label="Add my insight: Idea SL-1"');
    expect(html).not.toContain("SL-3");
    expect(html).not.toMatch(/\/\/streamlane\.app/);
  });

  it("says the roadmap could not be read, shows no idea, and points to the team, when the read failed", () => {
    const html = render({ state: "unread", team: team.url, readAt: today });
    expect(html).toContain("Streamlane's roadmap could not be read when this page was built, on 17 October 2026");
    expect(html).not.toContain("roadmap-idea");
    expect(html).not.toContain("insight");
    expect([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(["https://crv.streamlane.app/teams/SL"]);
  });

  it("says a build that reads no roadmap read none, and shows no idea", () => {
    const html = render({ state: "none" });
    expect(html).toContain("This build of the site reads no roadmap");
    expect(html).not.toContain("roadmap-idea");
  });

  it("says there is nothing on the roadmap when the team shows nothing yet", () => {
    const html = render({ ...read, ideas: [idea("SL-3", { stage: "inbox" })] } as RoadmapSnapshot);
    expect(html).toContain("Nothing is on Streamlane's roadmap yet.");
  });
});

describe("CRV-015: the roadmap in the product facts", () => {
  it("names Streamlane's own planning team, and its page here", () => {
    const streamlane = roadmapProduct("/streamlane/roadmap/");
    expect(streamlane.slug).toBe("streamlane");
    expect(streamlane.roadmap.team).toBe("https://crv.streamlane.app/teams/SL");
    expect(PRODUCTS.filter((p) => p.roadmap).map((p) => p.slug)).toEqual(["streamlane"]);
  });

  it("puts the link on Streamlane's card, which still reads 'Open to invited guests.' and links no product URL", () => {
    const grid = doorProductGrid();
    const card = grid.slice(grid.indexOf("{.product .streamlane}"), grid.indexOf("{.product .driftline}"));
    expect(card).toContain("Open to invited guests.");
    expect(card).toContain("(/streamlane/roadmap/)");
    expect(card).not.toMatch(/\]\(https?:/);
  });
});
