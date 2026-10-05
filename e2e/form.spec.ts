/** The interest form against the stub backend: validation, the thank-you, the rate-limited answer, and a failure. */
import { expect, type Page, test } from "@playwright/test";

const base = () => process.env.CRV_WEB_URL as string;

async function fill(page: Page, email = "ada@example.com") {
  await page.getByLabel("Your name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Organization").fill("Analytical Engines");
  await page.getByLabel("Advisor").check();
  await page.getByLabel("Message").fill("I would like to help.");
}

const sent = (page: Page) =>
  page.evaluate(() => (window as unknown as { __crvSubmissions?: unknown[] }).__crvSubmissions ?? []);

test("an empty form names the first missing field and sends nothing", async ({ page }) => {
  await page.goto(base());
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Your name is required.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();
  expect(await sent(page)).toEqual([]);
});

test("a bad address and no interest are each refused in words", async ({ page }) => {
  await page.goto(base());
  await page.getByLabel("Your name").fill("Ada");
  await page.getByLabel("Email").fill("not-an-address");
  await page.getByLabel("Message").fill("Hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Choose at least one way to take part.")).toBeVisible();
  await page.getByLabel("Funding").check();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("a valid submission is sent once, with where it came from, and thanked", async ({ page }) => {
  await page.goto(`${base()}/?site=streamlane`);
  await fill(page);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thank you" })).toBeFocused();
  expect(await sent(page)).toEqual([
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      organization: "Analytical Engines",
      interests: ["advisor"],
      message: "I would like to help.",
      site: "streamlane",
      website: "",
    },
  ]);
});

test("a rate-limited answer says when to try again and keeps what was typed", async ({ page }) => {
  await page.goto(base());
  await fill(page, "limited@example.com");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("try again in about 1 hour");
  await expect(page.getByLabel("Message")).toHaveValue("I would like to help.");
});

test("a failed send says so and points to the address", async ({ page }) => {
  await page.goto(base());
  await fill(page, "down@example.com");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("hello@coralreefventures.com");
});

test("a filled honeypot is answered as a success and sends nothing", async ({ page }) => {
  await page.goto(base());
  await fill(page);
  await page.locator('input[name="website"]').fill("http://spam.example", { force: true });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thank you.")).toBeVisible();
  expect(await sent(page)).toEqual([]);
});
