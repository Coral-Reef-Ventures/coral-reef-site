import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { doorSites, findSite, grantResource, siteList } from "../areas/access/sites.ts";
import {
  maxAdminEmailsBytes,
  parseAdminEmails,
  parseAdminOrigin,
  parseCallbackUrls,
  parseDomainPrefix,
  parseNoticeEmail,
  parseRoleName,
  parseSignInDomain,
  parseVisits,
  readAuthConfig,
} from "./settings.ts";

describe("CRV_AUTH_DOMAIN and CRV_AUTH_CERTIFICATE_ARN", () => {
  const certificateArn = "arn:aws:acm:us-east-1:027677878969:certificate/f360eb2b-4344-49ce-be8d-40b84b5967ba";

  it("are both set, or neither, as in a sandbox", () => {
    expect(parseSignInDomain({})).toBeUndefined();
    expect(
      parseSignInDomain({ CRV_AUTH_DOMAIN: " Auth.CoralReefVentures.com ", CRV_AUTH_CERTIFICATE_ARN: certificateArn }),
    ).toEqual({
      name: "auth.coralreefventures.com",
      certificateArn,
    });
    expect(() => parseSignInDomain({ CRV_AUTH_DOMAIN: "auth.coralreefventures.com" })).toThrow(/us-east-1/);
    expect(() => parseSignInDomain({ CRV_AUTH_CERTIFICATE_ARN: certificateArn })).toThrow(/not a hostname/);
  });

  it("refuses a certificate outside us-east-1, which Cognito cannot use", () => {
    expect(() =>
      parseSignInDomain({
        CRV_AUTH_DOMAIN: "auth.coralreefventures.com",
        CRV_AUTH_CERTIFICATE_ARN: certificateArn.replace("us-east-1", "us-east-2"),
      }),
    ).toThrow(/us-east-1/);
  });
});

describe("CRV_VISITS_APP_ID, CRV_VISITS_DOMAIN and CRV_VISITS_HOST", () => {
  const prod = {
    CRV_VISITS_APP_ID: "d5rsxrpztyob9",
    CRV_VISITS_DOMAIN: "coralreefventures.com",
    CRV_VISITS_HOST: "coralreefventures.com",
  };

  it("are all three, or none, as in a sandbox, which counts nothing", () => {
    expect(parseVisits({})).toBeUndefined();
    expect(parseVisits(prod)).toEqual({
      appId: "d5rsxrpztyob9",
      domain: "coralreefventures.com",
      host: "coralreefventures.com",
    });
    expect(() => parseVisits({ CRV_VISITS_APP_ID: "d5rsxrpztyob9" })).toThrow(/CRV_VISITS_DOMAIN/);
    expect(() => parseVisits({ ...prod, CRV_VISITS_HOST: "" })).toThrow(/CRV_VISITS_HOST/);
    expect(() => parseVisits({ ...prod, CRV_VISITS_APP_ID: "" })).toThrow(/CRV_VISITS_APP_ID/);
  });

  it("take an environment's own name under the domain, lowercased", () => {
    expect(
      parseVisits({
        ...prod,
        CRV_VISITS_DOMAIN: " CoralReefVentures.com ",
        CRV_VISITS_HOST: "Dev.CoralReefVentures.com",
      }),
    ).toEqual({ appId: "d5rsxrpztyob9", domain: "coralreefventures.com", host: "dev.coralreefventures.com" });
  });

  it.each([
    [{ CRV_VISITS_APP_ID: "arn:aws:amplify:us-east-2:1:apps/d5" }, /CRV_VISITS_APP_ID/],
    [{ CRV_VISITS_APP_ID: "D5RSX" }, /CRV_VISITS_APP_ID/],
    [{ CRV_VISITS_DOMAIN: "https://coralreefventures.com" }, /CRV_VISITS_DOMAIN/],
    [{ CRV_VISITS_HOST: "coralreefventures.com:443" }, /CRV_VISITS_HOST/],
    [{ CRV_VISITS_HOST: "driftline.app" }, /not coralreefventures.com or a name under it/],
    [{ CRV_VISITS_HOST: "evilcoralreefventures.com" }, /not coralreefventures.com or a name under it/],
  ])("refuses %j", (change, error) => expect(() => parseVisits({ ...prod, ...change })).toThrow(error));
});

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
      callbackUrls: ["http://localhost:3002/signed-in/"],
      logoutUrls: ["http://localhost:3002/signout/done/"],
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
    expect(parseAdminOrigin(undefined)).toBe("http://localhost:3002");
    expect(parseAdminOrigin("https://coralreefventures.com")).toBe("https://coralreefventures.com");
    expect(() => parseAdminOrigin("https://coralreefventures.com/admin")).toThrow();
    expect(() => parseAdminOrigin("http://coralreefventures.com")).toThrow();
  });
  it("CRV_BUILD_ROLE_NAME is a role name or unset", () => {
    expect(parseRoleName(undefined)).toBeUndefined();
    expect(parseRoleName("crv-amplify-backend-deploy")).toBe("crv-amplify-backend-deploy");
    expect(() => parseRoleName("a role")).toThrow();
  });
  it("CRV_NOTICE_EMAIL is hello@ when unset, nobody when empty, and an address otherwise", () => {
    expect(parseNoticeEmail(undefined)).toBe("hello@coralreefventures.com");
    expect(parseNoticeEmail("")).toBeUndefined();
    expect(parseNoticeEmail(" Hello@CoralReefVentures.com ")).toBe("hello@coralreefventures.com");
    expect(() => parseNoticeEmail("hello")).toThrow();
  });
  it("reads everything from one environment", () => {
    expect(readAuthConfig({ CRV_AUTH_DOMAIN_PREFIX: "crv-door" })).toMatchObject({
      domainPrefix: "crv-door",
      adminEmails: ["gary@coralreefventures.com"],
      buildRoleName: undefined,
      testHosts: "",
      visits: undefined,
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
  it("replaces each site's hosts with an environment's own", () => {
    expect(
      doorSites("", "streamlane=main.d1.amplifyapp.com,driftline=main.d2.amplifyapp.com").map((s) => [s.id, s.hosts]),
    ).toEqual([
      ["streamlane", ["main.d1.amplifyapp.com"]],
      ["driftline", ["main.d2.amplifyapp.com"]],
    ]);
    expect(doorSites("", "driftline=main.d2.amplifyapp.com")[0]?.hosts).toEqual(["streamlane.app"]);
  });
  it.each(["markset=markset.org", "driftline", "driftline=bad host", "driftline=a=b"])(
    "refuses the site hosts %j",
    (value) => expect(() => doorSites("", value)).toThrow(/CRV_DOOR_SITE_HOSTS/),
  );
  it("keys a site's grant by its production host, whatever host the environment serves it on", () => {
    const [streamlane, driftline] = doorSites("driftline:main.d123.amplifyapp.com", "streamlane=dev.streamlane.app");
    expect(streamlane && grantResource(streamlane)).toBe("site:streamlane.app");
    expect(driftline && grantResource(driftline)).toBe("site:driftline.app");
  });
  it("finds a site by id or host, and names one or two in the invitation's words", () => {
    const sites = doorSites("");
    expect(findSite(sites, "streamlane.app")?.id).toBe("streamlane");
    expect(findSite(sites, "driftline")?.id).toBe("driftline");
    expect(siteList(sites)).toBe("Streamlane and Driftline");
    expect(siteList(sites.slice(1))).toBe("Driftline");
  });
  it("matches the door's own copy of the list", () => {
    // Read as text: the door's list is private to its slice, and the two need only agree.
    const door = readFileSync(
      fileURLToPath(new URL("../../apps/web/src/features/access/door-session/sites.ts", import.meta.url)),
      "utf8",
    );
    const listed = [...door.matchAll(/\{ id: "(\w+)", host: "([\w.-]+)"/g)].map(([, id, host]) => [id, host]);
    expect(listed).toHaveLength(2);
    expect(listed.sort()).toEqual(
      doorSites("")
        .map((s) => [s.id, s.hosts[0]])
        .sort(),
    );
  });
});
