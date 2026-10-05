import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

describe("hosting files", () => {
  it("custom rules are valid, redirect www to the apex and end in the 404 rule", () => {
    const rules = JSON.parse(read("custom-rules.json")) as { source: string; target: string; status: string }[];
    expect(rules[0]).toEqual({
      source: "https://www.coralreefventures.com",
      target: "https://coralreefventures.com",
      status: "301",
    });
    expect(rules.at(-1)).toEqual({ source: "/<*>", target: "/404.html", status: "404" });
  });

  it("headers and build spec use the monorepo applications/appRoot shape for apps/web", () => {
    for (const name of ["custom-headers.yml", "build-spec.yml"]) {
      expect(read(name), name).toMatch(/^applications:\n {2}- appRoot: apps\/web$/m);
    }
  });

  it("the content security policy allows only the app, its us-east-2 AWS endpoints and the locked sites' forms", () => {
    const csp = read("custom-headers.yml").match(/Content-Security-Policy\n\s+value: "([^"]+)"/)?.[1] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self' https://streamlane.app https://driftline.app;");
    const origins = [...csp.matchAll(/https:\/\/[^\s;]+/g)].map((m) => m[0]);
    for (const origin of origins) {
      expect(origin, origin).toMatch(
        /^https:\/\/(streamlane\.app|driftline\.app|\*\.appsync-api\.us-east-2\.amazonaws\.com|cognito-idp\.us-east-2\.amazonaws\.com|cognito-identity\.us-east-2\.amazonaws\.com|crv-door\.auth\.us-east-2\.amazoncognito\.com)$/,
      );
    }
    expect(csp).not.toMatch(/script-src[^;]*https:/);
    expect(csp).not.toMatch(/font-src[^;]*https:/);
  });

  it("publishes the door key and caches only the Next.js build cache", () => {
    const spec = read("build-spec.yml");
    expect(spec).toContain("aws kms get-public-key");
    expect(spec).toContain("door-jwks.mjs");
    expect(spec).toContain("baseDirectory: out");
    expect(spec).toMatch(/- \.next\/cache\/\*\*\/\*/);
    expect(spec).not.toContain("node_modules/");
  });
});
