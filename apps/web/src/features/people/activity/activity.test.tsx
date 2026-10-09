import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Activity } from "../../../infrastructure/amplify/api.ts";
import { ActivityTable } from "./ActivityList.tsx";
import {
  buildDirectory,
  describeActor,
  describeSubject,
  detailSummary,
  emptyDirectory,
  filterByArea,
  kindLabel,
} from "./model.ts";

const a = (over: Partial<Activity>): Activity => ({
  id: "1",
  actorId: "system",
  area: "access",
  kind: "access.revoked",
  subjectType: "Invitation",
  subjectId: "x",
  at: "2026-10-04T13:05:00Z",
  ...over,
});

const directory = buildDirectory(
  [{ email: "dee@example.com", personId: "01PERSON0000000000000000DEE" }],
  [{ id: "01SUB", name: "Ada Example", email: "ada@example.com", personId: "01PERSON0000000000000000ADA" }],
);

describe("activity", () => {
  it("labels known kinds and keeps an unknown one readable", () => {
    expect(kindLabel("access.revoked")).toBe("Revoked");
    expect(kindLabel("access.ticket_issued")).toBe("Let in");
    expect(kindLabel("licence.issued")).toBe("licence.issued");
  });

  it("filters by area", () => {
    const rows = [a({}), a({ id: "2", area: "interest" })];
    expect(filterByArea(rows, "interest").map((r) => r.id)).toEqual(["2"]);
    expect(filterByArea(rows, undefined)).toHaveLength(2);
  });
});

describe("the directory", () => {
  it("takes an address from an invitation and a name from a submission", () => {
    expect(directory.people["01PERSON0000000000000000DEE"]).toBe("dee@example.com");
    expect(directory.people["01PERSON0000000000000000ADA"]).toBe("Ada Example (ada@example.com)");
    expect(directory.submissions["01SUB"]).toBe("Ada Example (ada@example.com)");
  });

  it("prefers a submitter's name over the bare address the invitation holds", () => {
    const both = buildDirectory(
      [{ email: "ada@example.com", personId: "01PERSON0000000000000000ADA" }],
      [{ id: "01SUB", name: "Ada Example", email: "ada@example.com", personId: "01PERSON0000000000000000ADA" }],
    );
    expect(both.people["01PERSON0000000000000000ADA"]).toBe("Ada Example (ada@example.com)");
  });

  it("names a subject it knows, and keeps the id in the title", () => {
    const row = a({ subjectType: "Person", subjectId: "01PERSON0000000000000000ADA" });
    expect(describeSubject(row, directory)).toEqual({
      text: "Ada Example (ada@example.com)",
      title: "Person 01PERSON0000000000000000ADA",
    });
  });

  it("cuts an id it does not know short, and leaves an address alone", () => {
    const unknown = a({ subjectType: "Person", subjectId: "01PERSON0000000000000000ZZZ" });
    expect(describeSubject(unknown, emptyDirectory).text).toBe("Person 01PERSON00…");
    const invitation = a({ subjectType: "Invitation", subjectId: "eli@example.com" });
    expect(describeSubject(invitation, emptyDirectory).text).toBe("eli@example.com");
  });

  it("names the actors a person is not", () => {
    expect(describeActor("system", emptyDirectory)).toEqual({ text: "System" });
    expect(describeActor("user:abc-123", emptyDirectory)).toEqual({ text: "Admin", title: "user:abc-123" });
    expect(describeActor("01PERSON0000000000000000DEE", directory).text).toBe("dee@example.com");
  });
});

describe("the detail summary", () => {
  it("names a site by its id or its host", () => {
    expect(detailSummary({ site: "driftline", host: "driftline.app", jti: "01TICKET" })).toBe("Driftline");
    expect(detailSummary({ site: "crv" })).toBe("Coral Reef Ventures");
    expect(detailSummary({ sites: ["streamlane.app", "driftline.app"] })).toBe("Streamlane, Driftline");
    expect(detailSummary({ sites: [] })).toBe("No sites");
  });

  it("says the words the other keys hold", () => {
    expect(detailSummary({ from: "new", to: "reviewing" })).toBe("New → Reviewing");
    expect(detailSummary({ mode: "cleared" })).toBe("Binding cleared");
    expect(detailSummary({ source: "admin-bootstrap" })).toBe("Break-glass admin");
  });

  it("shows nothing for a key it was not told about, or a value outside the closed set", () => {
    expect(detailSummary(undefined)).toBe("");
    expect(detailSummary({ secret: "do-not-show" })).toBe("");
    expect(detailSummary({ site: "https://evil.example" })).toBe("");
    expect(detailSummary({ from: "new", to: "<script>" })).toBe("");
    expect(detailSummary({ grantId: "01GRANT", jti: "01TICKET", length: 12 })).toBe("");
  });
});

describe("the table", () => {
  const draw = (rows: Activity[], dir = emptyDirectory) =>
    renderToStaticMarkup(
      <MantineProvider>
        <ActivityTable rows={rows} directory={dir} />
      </MantineProvider>,
    );

  it("draws the rows with a UTC time, and never a detail it was not told about", () => {
    const html = draw([a({ detail: { secret: "do-not-show" } })]);
    expect(html).toContain("2026-10-04 13:05 UTC");
    expect(html).toContain("Revoked");
    expect(html).not.toContain("do-not-show");
  });

  it("names the person and the site a ticket opened", () => {
    const html = draw(
      [
        a({
          kind: "access.ticket_issued",
          subjectType: "Person",
          subjectId: "01PERSON0000000000000000ADA",
          actorId: "01PERSON0000000000000000ADA",
          detail: { site: "driftline", host: "driftline.app", grantId: "01GRANT", jti: "01TICKET" },
        }),
      ],
      directory,
    );
    expect(html).toContain("Let in");
    expect(html).toContain("Driftline");
    expect(html).toContain("Ada Example (ada@example.com)");
    expect(html).not.toContain("01TICKET");
    expect(html).not.toContain("01GRANT");
  });

  it("falls back to the ids when the directory never loaded", () => {
    const html = draw([a({ subjectType: "Person", subjectId: "01PERSON0000000000000000ADA", actorId: "system" })]);
    expect(html).toContain("Person 01PERSON00…");
    expect(html).toContain("System");
  });
});
