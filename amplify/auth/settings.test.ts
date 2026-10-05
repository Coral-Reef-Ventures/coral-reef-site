import { describe, expect, it } from "vitest";

import { doorSites, findSite, siteList } from "../areas/access/sites.ts";
import {
  maxAdminEmailsBytes,
  parseAdminEmails,
  parseAdminOrigin,
  parseCallbackUrls,
  parseDomainPrefix,
  parseRoleName,
  readAuthConfig,
} from "./settings.ts";

describe("CRV_AUTH_DOMAIN_PREFIX", () => {
  it("takes crv-door and crv-door-sandbox", () => {
    expect(parseDomainPrefix("crv-door")).toBe("crv-door");
    expect(parseDomainPrefix(" crv-door-sandbox ")).toBe("crv-door-sandbox");
  });
  it.each([undefined, "", "CRV", "-crv", "crv-", "my-aws-door", "amazon-door", "cognito-door", "crv_door"])(
    "refuses %j",
    (value) => expect(() => parseDomainPrefix(value)).toThrow(/CRV_AUTH_DOMAIN_PREFIX/),
  );
});

describe("CRV_AUTH_CALLBACK_URLS", () => {
  it("defaults to the local dev server's two pages", () => {
    expect(parseCallbackUrls(undefined)).toEqual({
      callbackUrls: ["http://localhost:3003/signed-in/"],
      logoutUrls: ["http://localhost:3003/signout/done/"],
    });
  });
  it("splits every origin's URLs by page", () => {
    expect(
      parseCallbackUrls(
        "https://main.d1.amplifyapp.com/signed-in/, https://coralreefventures.com/signed-in/,https://coralreefventures.com/signout/done/",
      ),
    ).toEqual({
      callbackUrls: ["https://main.d1.amplifyapp.com/signed-in/", "https://coralreefventures.com/signed-in/"],
      logoutUrls: ["https://coralreefventures.com/signout/done/"],
    });
  });
  it.each([
    "http://coralreefventures.com/signed-in/,https://coralreefventures.com/signout/done/",
    "https://coralreefventures.com/other/,https://coralreefventures.com/signout/done/",
    "https://coralreefventures.com/signed-in/",
    "https://coralreefventures.com/signed-in/?x=1,https://coralreefventures.com/signout/done/",
  ])("refuses %s", (value) => expect(() => parseCallbackUrls(value)).toThrow(/CRV_AUTH_CALLBACK_URLS/));
});

describe("CRV_ADMIN_EMAILS", () => {
  it("defaults to Gary, the first admin, and lowercases and dedupes", () => {
    expect(parseAdminEmails(undefined)).toEqual(["gary@coralreefventures.com"]);
    expect(parseAdminEmails(" Gary@CoralReefVentures.com ,gary@coralreefventures.com")).toEqual([
      "gary@coralreefventures.com",
    ]);
    expect(parseAdminEmails("")).toEqual([]);
  });
  it("refuses a value that is not an address, and a list over 512 bytes", () => {
    expect(() => parseAdminEmails("gary")).toThrow(/not an email address/);
    const long = Array.from({ length: 40 }, (_, i) => `admin${i}@coralreefventures.com`).join(",");
    expect(Buffer.byteLength(long)).toBeGreaterThan(maxAdminEmailsBytes);
    expect(() => parseAdminEmails(long)).toThrow(/over 512/);
  });
});

describe("the other settings", () => {
  it("CRV_ADMIN_ORIGIN is an origin and nothing more", () => {
    expect(parseAdminOrigin(undefined)).toBe("http://localhost:3003");
    expect(parseAdminOrigin("https://coralreefventures.com")).toBe("https://coralreefventures.com");
    expect(() => parseAdminOrigin("https://coralreefventures.com/admin")).toThrow();
    expect(() => parseAdminOrigin("http://coralreefventures.com")).toThrow();
  });
  it("CRV_BUILD_ROLE_NAME is a role name or unset", () => {
    expect(parseRoleName(undefined)).toBeUndefined();
    expect(parseRoleName("crv-amplify-backend-deploy")).toBe("crv-amplify-backend-deploy");
    expect(() => parseRoleName("a role")).toThrow();
  });
  it("reads everything from one environment", () => {
    expect(readAuthConfig({ CRV_AUTH_DOMAIN_PREFIX: "crv-door" })).toMatchObject({
      domainPrefix: "crv-door",
      adminEmails: ["gary@coralreefventures.com"],
      buildRoleName: undefined,
      testHosts: "",
    });
  });
});

describe("the site registry", () => {
  it("holds the two locked sites, and adds a test host to its site", () => {
    expect(doorSites("").map((s) => [s.id, s.hosts])).toEqual([
      ["streamlane", ["streamlane.app"]],
      ["driftline", ["driftline.app"]],
    ]);
    expect(doorSites("driftline:main.d123.amplifyapp.com")[1]?.hosts).toEqual([
      "driftline.app",
      "main.d123.amplifyapp.com",
    ]);
  });
  it.each(["markset:markset.org", "driftline", "driftline:bad host", "driftline:a:b"])("refuses %j", (value) =>
    expect(() => doorSites(value)).toThrow(/CRV_DOOR_TEST_HOSTS/),
  );
  it("finds a site by id or host, and names one or two in the invitation's words", () => {
    const sites = doorSites("");
    expect(findSite(sites, "streamlane.app")?.id).toBe("streamlane");
    expect(findSite(sites, "driftline")?.id).toBe("driftline");
    expect(siteList(sites)).toBe("Streamlane and Driftline");
    expect(siteList(sites.slice(1))).toBe("Driftline");
  });
  it("matches the door's own copy of the list", async () => {
    const { lockedSites } = await import("../../apps/web/src/features/access/door-session/sites.ts");
    expect(lockedSites.map((s) => [s.id, s.host]).sort()).toEqual(
      doorSites("")
        .map((s) => [s.id, s.hosts[0]])
        .sort(),
    );
  });
});
