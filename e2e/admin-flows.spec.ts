/**
 * The admin views over the in-memory stub (the second export global-setup.ts builds, at CRV_ADMIN_URL). Each page load
 * makes a fresh stub with the same sample data, so the tests do not share state.
 */
import { expect, test } from "@playwright/test";

const admin = () => process.env.CRV_ADMIN_URL as string;

test("inviting from a submission leaves its review form on the invited status, so Save cannot undo it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${admin()}/admin/submission/?id=01STUB-S1`);

  const review = page.getByRole("region", { name: "Review" });
  const status = review.getByRole("combobox", { name: "Status" });
  const save = review.getByRole("button", { name: "Save" });
  await expect(status).toHaveValue("New");
  await expect(save).toBeDisabled();

  const invite = page.getByRole("region", { name: "Invite" });
  await invite.getByRole("checkbox", { name: "streamlane.app" }).check();
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(invite.getByRole("status", { name: "Invitation created" })).toBeVisible();

  // The reload brought the submission back as invited, and the form moved onto it rather than keeping "New".
  await expect(status).toHaveValue("Invited");
  await expect(status).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(review.getByRole("button", { name: "Discard changes" })).toHaveCount(0);

  // Notes can still be saved, and saving them keeps the invited status.
  await review.getByRole("textbox", { name: "Notes" }).fill("Invited to Streamlane.");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(review.getByText("Saved.")).toBeVisible();
  await expect(status).toHaveValue("Invited");
  const activity = page.getByRole("region", { name: "Activity" });
  await expect(activity.getByText(/note added/i).first()).toBeVisible();
  await expect(activity.getByText(/status changed/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a submission not yet invited cannot be set to invited by hand", async ({ page }) => {
  await page.goto(`${admin()}/admin/submission/?id=01STUB-S2`);
  const status = page.getByRole("region", { name: "Review" }).getByRole("combobox", { name: "Status" });
  await expect(status).toHaveValue("Reviewing");
  await status.click();
  await expect(page.getByRole("option", { name: "Declined" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Invited" })).toHaveCount(0);
});
