import { describe, expect, it } from "vitest";

import { forwardFor } from "./forward.ts";

describe("forwardFor, the home page's forward to /get-involved/", () => {
  it("leaves an ordinary visit to the home page alone", () => {
    expect(forwardFor("", "")).toBeNull();
    expect(forwardFor("", "#work")).toBeNull();
    expect(forwardFor("?utm=x", "")).toBeNull();
  });

  it("sends a locked site's request on with its query unchanged", () => {
    const search = "?site=driftline&host=driftline.app&next=%2Fdocs%2F&state=AAAAAAAAAAAAAAAAAAAAAA";
    expect(forwardFor(search, "")).toBe(`/get-involved/${search}`);
  });

  it("sends a refused sign-in, a refused ticket and a visitor's source site on", () => {
    expect(forwardFor("?error=NOT_INVITED", "")).toBe("/get-involved/?error=NOT_INVITED");
    expect(forwardFor("?error=ticket", "")).toBe("/get-involved/?error=ticket");
    expect(forwardFor("?site=streamlane", "")).toBe("/get-involved/?site=streamlane");
  });

  it("sends an older link to either moved section on, to the same section", () => {
    expect(forwardFor("", "#invited")).toBe("/get-involved/#invited");
    expect(forwardFor("", "#involved")).toBe("/get-involved/#involved");
  });
});
