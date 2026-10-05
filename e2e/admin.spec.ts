/**
 * The admin views in a build with no admin backend bound, which is what global-setup.ts builds (the door's stub, not the
 * admin's). Each view's load asks getAdminApi() for the backend, and that throws before any promise exists; the view
 * must turn it into its error notice rather than let it escape and take the page down.
 */
import { expect, test } from "@playwright/test";

const base = () => process.env.CRV_WEB_URL as string;
const views = ["/admin/", "/admin/invitations/", "/admin/activity/", "/admin/submission/?id=01A"];

for (const path of views) {
  test(`${path} says the backend is not connected, and does not crash`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base() + path);
    const notice = page.getByRole("alert").filter({ hasText: "Could not complete that" });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("The admin backend is not connected in this build.");
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
