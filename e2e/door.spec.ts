/**
 * The door in Chromium, at the two widths CRV-005 names and in both color schemes: the checks page.spec.ts runs on the
 * old page, ported to the pages of the app (global-setup.ts builds it with the stub backend and serves it).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const base = () => process.env.CRV_WEB_URL as string;
const pages = ["/", "/get-involved/", "/privacy/", "/signout/"];

async function open(page: Page, path: string, width: number, colorScheme: "light" | "dark"): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme });
  await page.goto(base() + path);
}

for (const path of pages) {
  for (const width of [390, 1440]) {
    test(`${path}: nothing scrolls sideways or is clipped at ${width}px, and every link is a tap target`, async ({
      page,
    }) => {
      await open(page, path, width, "light");
      await page.waitForTimeout(300);
      const result = await page.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth;
        const outside = [...document.querySelectorAll("main *, header *, footer *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && !el.closest("[aria-hidden='true']") && (r.left < 0 || r.right > innerWidth);
          })
          .map((el) => el.outerHTML.slice(0, 80));
        const small = [
          ...document.querySelectorAll("a, button, input:not([type=radio]):not([type=checkbox]):not([aria-hidden])"),
        ]
          .filter((el) => !el.classList.contains("skip-link"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height < 24 && !el.closest("p, li, .ms-document");
          })
          .map((el) => el.outerHTML.slice(0, 60));
        return { scrollWidth, outside, small };
      });
      expect(result.scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(width);
      expect(result.outside).toEqual([]);
      expect(result.small).toEqual([]);
    });
  }
}

test("the keyboard reaches every link, control and the scheme control in order, each with a visible focus ring", async ({
  page,
}) => {
  await open(page, "/get-involved/", 1440, "light");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelector("a")?.textContent)).toBe("Skip to content");
  const rings: string[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (el === document.body) return "END";
      const ringed =
        el instanceof HTMLInputElement && el.type === "radio" ? (el.nextElementSibling as HTMLElement) : el;
      const style = getComputedStyle(ringed);
      return `${el.tagName}:${style.outlineStyle}:${style.outlineWidth}`;
    });
    if (ring === "END") break;
    rings.push(ring);
  }
  expect(rings.length, "the page's stops").toBeGreaterThan(10);
  expect(rings.length, "tabbing ended").toBeLessThan(80);
  for (const ring of rings) expect(ring, "a focus stop has no ring").toMatch(/:(solid|auto):(3px|2px|1px)/);
  expect(rings[0]).toContain("A:");
});

test("the skip link moves focus into the main content", async ({ page }) => {
  await open(page, "/", 390, "light");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

for (const scheme of ["light", "dark"] as const) {
  for (const path of ["/", "/get-involved/", "/privacy/"]) {
    test(`${path}: every text element meets WCAG AA contrast in the ${scheme} scheme`, async ({ page }) => {
      await open(page, path, 1440, scheme);
      await page.waitForTimeout(300);
      const failures = await page.evaluate(() => {
        const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a: string, b: string) => {
          const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        // The page draws text on the body, on a form control, and on the sent and notice panels.
        const background = (el: Element): string => {
          for (let e: Element | null = el; e; e = e.parentElement) {
            const c = getComputedStyle(e).backgroundColor;
            if (c && !c.startsWith("rgba(0, 0, 0, 0") && c !== "transparent") return c;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || !n.textContent?.trim() || el.closest(".skip-link, noscript, script, style")) continue;
          const style = getComputedStyle(el);
          const size = Number.parseFloat(style.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
          const r = ratio(style.color, background(el));
          if (r < (large ? 3 : 4.5)) out.push(`${n.textContent.trim().slice(0, 40)}: ${r.toFixed(2)}`);
        }
        return out;
      });
      expect(failures).toEqual([]);
    });
  }
}

test("the home page has one h1 and neither the form nor the sign-in; the Get involved page has one h1 and both", async ({
  page,
}) => {
  await page.goto(`${base()}/`);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Get involved" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Have an invitation?" })).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" }).first().getByRole("link")).toHaveText(["Get involved"]);

  await page.goto(`${base()}/get-involved/`);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Get involved" })).toHaveAttribute("id", "involved");
  await expect(page.getByRole("heading", { level: 2, name: "Have an invitation?" })).toHaveAttribute("id", "invited");
  await expect(page.getByRole("form", { name: "Get involved" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page).toHaveTitle(/^Get involved/);
});

test("a locked site's request to the door's origin, and an old link to a moved section, reach the Get involved page", async ({
  page,
}) => {
  const query = `?site=driftline&host=driftline.app&next=%2Fdocs%2F&state=${"A".repeat(22)}`;
  await page.goto(`${base()}/${query}`);
  await page.waitForURL(`${base()}/get-involved/${query}`);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await page.goto(`${base()}/#invited`);
  await page.waitForURL(`${base()}/get-involved/#invited`);
  await page.goto(`${base()}/?error=NOT_INVITED`);
  await page.waitForURL(`${base()}/get-involved/?error=NOT_INVITED`);
});

test("the invitation sign-in offers Google, and carries what a site asked for through it", async ({ page }) => {
  const state = "A".repeat(22);
  await page.goto(`${base()}/get-involved/?site=driftline&host=driftline.app&next=%2Fdocs%2F&state=${state}`);
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const carried = await page.evaluate(() => (window as unknown as { __crvSignIn?: string }).__crvSignIn);
  expect(JSON.parse(carried ?? "{}")).toEqual({ site: "driftline", host: "driftline.app", next: "/docs/", state });
});

test("a refused sign-in says there is no invitation and starts the form with that", async ({ page }) => {
  await page.goto(`${base()}/get-involved/?error=NOT_INVITED`);
  await expect(page.getByText("There is no invitation for that Google account yet.")).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveValue(/no invitation for that account/);
});

test("an invited, signed-in visitor is offered each site they may continue to", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("crv-stub-session", "invited"));
  await page.goto(`${base()}/signed-in/`);
  await expect(page.getByRole("link", { name: "Continue to Driftline" })).toHaveAttribute(
    "href",
    "https://driftline.app/",
  );
  await expect(page.getByRole("link", { name: "Continue to Streamlane" })).toHaveAttribute(
    "href",
    "https://streamlane.app/",
  );
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("a signed-in stranger is sent back to the door with the form", async ({ page }) => {
  // Seeded once: the stub ends the session on the way out, and a script that set it on every page would sign them back in.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("crv-stub-session", "stranger");
    }
  });
  await page.goto(`${base()}/signed-in/`);
  await page.waitForURL(/\/get-involved\/\?error=NOT_INVITED/);
  await expect(page.getByText("There is no invitation for that Google account yet.")).toBeVisible();
});

test("the output has no third-party origin, no external font and no document.cookie write", async ({ page }) => {
  const origins = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http")) origins.add(url.origin);
  });
  await page.addInitScript(() => {
    (window as unknown as { __cookieWrites: string[] }).__cookieWrites = [];
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: (value: string) => (window as unknown as { __cookieWrites: string[] }).__cookieWrites.push(value),
    });
  });
  for (const path of pages) {
    await page.goto(base() + path);
    await page.waitForTimeout(300);
  }
  expect([...origins]).toEqual([base()]);
  expect(await page.evaluate(() => (window as unknown as { __cookieWrites: string[] }).__cookieWrites)).toEqual([]);

  // And the files themselves: no markup or stylesheet names another origin or a font file.
  const out = process.env.CRV_WEB_OUT as string;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(html|css)$/.test(name)) files.push(full);
    }
  };
  walk(out);
  expect(files.length).toBeGreaterThan(3);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    expect(text, file).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(text, file).not.toMatch(/@font-face/);
    // The page's own links to other sites are anchors; what must never load from elsewhere is src and stylesheet urls.
    expect(text, file).not.toMatch(
      /<(?:script|img|link|iframe)\b[^>]*(?:src|href)="https?:\/\/(?!coralreefventures\.com)/,
    );
    expect(text, file).not.toMatch(/url\(\s*["']?https?:/);
  }
});
