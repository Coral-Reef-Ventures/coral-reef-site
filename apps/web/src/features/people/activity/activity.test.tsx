import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Activity } from "../../../infrastructure/amplify/api.ts";
import { ActivityTable } from "./ActivityList.tsx";
import { filterByArea, kindLabel } from "./model.ts";

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

describe("activity", () => {
  it("labels known kinds and keeps an unknown one readable", () => {
    expect(kindLabel("access.revoked")).toBe("Revoked");
    expect(kindLabel("licence.issued")).toBe("licence.issued");
  });

  it("filters by area", () => {
    const rows = [a({}), a({ id: "2", area: "interest" })];
    expect(filterByArea(rows, "interest").map((r) => r.id)).toEqual(["2"]);
    expect(filterByArea(rows, undefined)).toHaveLength(2);
  });

  it("draws the rows with a UTC time, and never the detail", () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ActivityTable rows={[a({ detail: { secret: "do-not-show" } })]} />
      </MantineProvider>,
    );
    expect(html).toContain("2026-10-04 13:05 UTC");
    expect(html).toContain("Revoked");
    expect(html).not.toContain("do-not-show");
  });
});
