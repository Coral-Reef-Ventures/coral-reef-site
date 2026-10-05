import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Submission } from "../../../infrastructure/amplify/api.ts";
import { countByStatus, isStale, readSubmissionId } from "./model.ts";
import { SubmissionsTable } from "./SubmissionsTable.tsx";

const now = new Date("2026-10-05T00:00:00Z");
const row = (over: Partial<Submission>): Submission => ({
  id: "01A",
  name: "Ada <b>",
  email: "ada@example.com",
  organization: "Example",
  interests: ["design_partner"],
  message: "hi",
  sourceSite: "crv",
  status: "new",
  statusAt: "2026-10-04T00:00:00Z",
  notes: "",
  receivedAt: "2026-10-04T00:00:00Z",
  ...over,
});

describe("submissions model", () => {
  it("flags new and reviewing submissions older than 30 days, and nothing else", () => {
    const old = "2026-08-01T00:00:00Z";
    expect(isStale(row({ receivedAt: old }), now)).toBe(true);
    expect(isStale(row({ receivedAt: old, status: "reviewing" }), now)).toBe(true);
    expect(isStale(row({ receivedAt: old, status: "declined" }), now)).toBe(false);
    expect(isStale(row({ receivedAt: "2026-09-20T00:00:00Z" }), now)).toBe(false);
  });

  it("counts by status", () => {
    expect(countByStatus([row({}), row({ status: "invited" }), row({})])).toMatchObject({ new: 2, invited: 1 });
  });

  it("reads only a plain id from the query", () => {
    expect(readSubmissionId("?id=01ARZ3")).toBe("01ARZ3");
    expect(readSubmissionId("?id=../x")).toBeUndefined();
    expect(readSubmissionId("")).toBeUndefined();
  });
});

describe("SubmissionsTable", () => {
  const render = (rows: Submission[]) =>
    renderToStaticMarkup(
      <MantineProvider>
        <SubmissionsTable rows={rows} now={now} />
      </MantineProvider>,
    );

  it("links each row to its detail and escapes what the visitor wrote", () => {
    const html = render([row({})]);
    expect(html).toMatch(/href="\/admin\/submission\/?\?id=01A"/);
    expect(html).toContain("Ada &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("marks a stale row and says so when empty", () => {
    expect(render([row({ receivedAt: "2026-08-01T00:00:00Z" })])).toContain("Over 30 days");
    expect(render([])).toContain("No submissions with this status.");
  });
});
