import { describe, expect, it } from "vitest";

import { doorPassingScript, passingAttribute, showPage } from "./passing.ts";

/** Runs the script against a stand-in body and location, and returns the attributes it set. */
const run = (search: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const body = { setAttribute: (name: string, value: string) => (attributes[name] = value) };
  new Function("document", "location", doorPassingScript)({ body }, { search });
  return attributes;
};

describe("passing through", () => {
  it("marks a visit carrying a locked site's request with that site's name", () => {
    expect(run(`?site=streamlane&host=streamlane.app&next=%2F&state=${"A".repeat(22)}`)).toEqual({
      [passingAttribute]: "Streamlane",
    });
  });

  it("leaves every other visit alone: no request, a host that is not the site's, an unknown site, no state", () => {
    expect(run("")).toEqual({});
    expect(run("?site=streamlane")).toEqual({});
    expect(run("?site=streamlane&host=evil.example&state=x")).toEqual({});
    expect(run("?site=evil&host=evil.example&state=x")).toEqual({});
    expect(run("?site=driftline&host=driftline.app")).toEqual({});
  });

  it("shows the page again by removing the mark", () => {
    const removed: string[] = [];
    showPage({ removeAttribute: (name: string) => removed.push(name) });
    expect(removed).toEqual([passingAttribute]);
  });
});
