/**
 * The built page in Chromium, at the two widths CRV-005 names and in both
 * color schemes.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const url = pathToFileURL(join(import.meta.dirname, ".build", "index.html")).href;

async function open(page: Page, width: number, colorScheme: "light" | "dark"): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme });
  await page.goto(url);
}

for (const width of [390, 1440]) {
  test(`CRV-005: nothing scrolls sideways or is clipped at ${width}px`, async ({ page }) => {
    await open(page, width, "light");
    const result = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const outside = [...document.querySelectorAll("main *, header *, footer *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < 0 || r.right > innerWidth);
        })
        .map((el) => el.outerHTML.slice(0, 80));
      const smallTargets = [...document.querySelectorAll("a")]
        .filter((a) => !a.classList.contains("site-skip"))
        .filter((a) => a.getBoundingClientRect().height < 24)
        .map((a) => a.textContent);
      return { scrollWidth, outside, smallTargets };
    });
    expect(result.scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(width);
    expect(result.outside).toEqual([]);
    expect(result.smallTargets).toEqual([]);
  });
}

test("CRV-006: the keyboard reaches every link and the scheme control in reading order, with a visible focus ring", async ({
  page,
}) => {
  await open(page, 1440, "light");
  // The scheme control is one stop, its checked radio, as any radio group is.
  const name = (el: Element) => (el instanceof HTMLInputElement ? `scheme:${el.id}` : el.textContent?.trim());
  const expected = await page.evaluate(
    (fn) => [...document.querySelectorAll("a, .site-scheme-input:checked")].map(new Function(`return (${fn})`)()),
    name.toString(),
  );
  expect(expected.length).toBeGreaterThan(3);
  const seen: Array<{ label: string | undefined; outline: string }> = [];
  for (let i = 0; i < expected.length; i++) {
    await page.keyboard.press("Tab");
    seen.push(
      await page.evaluate((fn) => {
        const el = document.activeElement as HTMLElement;
        // A radio is clipped out of sight, so its ring is drawn on its label.
        const ringed = el instanceof HTMLInputElement ? (el.nextElementSibling as HTMLElement) : el;
        const style = getComputedStyle(ringed);
        return { label: new Function(`return (${fn})`)()(el), outline: `${style.outlineStyle} ${style.outlineWidth}` };
      }, name.toString()),
    );
  }
  expect(seen.map((s) => s.label)).toEqual(expected);
  expect(seen[0].label).toBe("Skip to content");
  for (const s of seen) expect(s.outline, `${s.label} has no visible focus`).toBe("solid 3px");
});

test("CRV-006: the skip link moves focus to the main content", async ({ page }) => {
  await open(page, 390, "light");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

for (const scheme of ["light", "dark"] as const) {
  test(`CRV-006: every text element meets WCAG AA contrast in the ${scheme} scheme`, async ({ page }) => {
    await open(page, 1440, scheme);
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
      // Nothing on the page draws a background behind text except the body.
      const bg = getComputedStyle(document.body).backgroundColor;
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent?.trim() || el.closest(".site-skip")) continue;
        const style = getComputedStyle(el);
        const size = Number.parseFloat(style.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        const r = ratio(style.color, bg);
        if (r < (large ? 3 : 4.5)) out.push(`${n.textContent.trim().slice(0, 40)}: ${r.toFixed(2)}`);
      }
      return out;
    });
    expect(failures).toEqual([]);
  });
}
