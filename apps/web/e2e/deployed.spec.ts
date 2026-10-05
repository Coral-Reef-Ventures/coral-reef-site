import process from "node:process";

import { expect, test } from "@playwright/test";

/**
 * The admin flows, in a browser, against a build of apps/web that has the in-memory backend:
 *
 *   NEXT_PUBLIC_CRV_ADMIN_STUB=1 pnpm web:build
 *   (cd apps/web/out && python3 -m http.server 4173) &
 *   cd apps/web && CRV_ADMIN_URL=http://localhost:4173 pnpm exec playwright test
 *
 * It skips when CRV_ADMIN_URL is not set, so CI, which does not run this config, is unaffected. Once the backend is bound and the
 * app is deployed, the door flows join this file; an admin session is then needed and these flows run signed in.
 */
const base = process.env.CRV_ADMIN_URL;
test.skip(!base, "CRV_ADMIN_URL is not set");

test.describe("admin views", () => {
  test("filters submissions by status and opens one", async ({ page }) => {
    await page.goto(`${base}/admin/`);
    await expect(page.getByRole("link", { name: "Ada Example" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ben Sample" })).toHaveCount(0);
    await page.getByText("Reviewing", { exact: true }).click();
    await expect(page.getByText("Over 30 days")).toBeVisible();
    await page.getByRole("link", { name: "Ben Sample" }).click();
    await expect(page.getByRole("heading", { name: "Ben Sample" })).toBeVisible();
    await expect(page.getByText("Written by the visitor and not verified.")).toBeVisible();
  });

  test("saves a status and a note, and the change shows in Activity", async ({ page }) => {
    await page.goto(`${base}/admin/`);
    await page.getByRole("link", { name: "Ada Example" }).click();
    await page.getByLabel("Notes").fill("Call booked");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Note added" })).toBeVisible();
  });

  test("invites from a submission and offers the text to copy", async ({ page }) => {
    await page.goto(`${base}/admin/`);
    await page.getByRole("link", { name: "Ada Example" }).click();
    await page.getByLabel("driftline.app").check();
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    const text = page.getByLabel("Invitation text");
    await expect(text).toHaveValue(/ada@example\.com/);
    await expect(page.getByRole("button", { name: "Copy invitation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open in mail" })).toHaveAttribute(
      "href",
      /^mailto:ada%40example\.com/,
    );
  });

  test("refuses an invitation with no site chosen", async ({ page }) => {
    await page.goto(`${base}/admin/invitations/`);
    await page.getByLabel("Email").first().fill("new@example.com");
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText("Choose at least one site.")).toBeVisible();
  });

  test("revoking asks first, and a stray click changes nothing", async ({ page }) => {
    await page.goto(`${base}/admin/invitations/`);
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByRole("button", { name: /^Revoke eli@example\.com$/ })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("eli@example.com")).toBeVisible();
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await page.getByRole("button", { name: /^Revoke eli@example\.com$/ }).click();
    await page.getByText("Revoked", { exact: true }).click();
    await expect(page.getByText("eli@example.com")).toBeVisible();
  });

  test("lists activity by area", async ({ page }) => {
    await page.goto(`${base}/admin/activity/`);
    await expect(page.getByRole("cell", { name: "Interest submitted" })).toBeVisible();
    await page.getByText("Access", { exact: true }).click();
    await expect(page.getByRole("cell", { name: "Interest submitted" })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "Invited" })).toBeVisible();
  });

  test("does not overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const path of ["/admin/", "/admin/invitations/", "/admin/activity/"]) {
      await page.goto(`${base}${path}`);
      await page.waitForLoadState("networkidle");
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, path).toBeLessThanOrEqual(390);
    }
  });
});
