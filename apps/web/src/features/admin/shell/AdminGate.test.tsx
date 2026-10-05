import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdminAccess } from "../../../infrastructure/amplify/api.ts";
import { AdminGate } from "./AdminGate.tsx";

const render = (access: AdminAccess | null, problem?: string) =>
  renderToStaticMarkup(
    <MantineProvider>
      <AdminGate access={access} onSignIn={() => {}} problem={problem}>
        <p>the views</p>
      </AdminGate>
    </MantineProvider>,
  );

describe("AdminGate", () => {
  it("shows nothing while the session is read", () => {
    expect(render(null)).not.toContain("the views");
    expect(render(null)).not.toContain("Sign in");
  });

  it("offers the sign-in, and no view, with no session", () => {
    const html = render("signed-out");
    expect(html).toMatch(/<button[^>]*>.*Sign in.*<\/button>/);
    expect(html).not.toContain("the views");
    expect(html).not.toContain("not connected");
  });

  it("shows a failed sign-in's code above the button", () => {
    const html = render("signed-out", "SIGN_IN_FAILED");
    expect(html).toContain("SIGN_IN_FAILED");
    expect(html).toContain('role="alert"');
  });

  it("says a signed-in account that is not an admin is not one, and offers the door's sign-out", () => {
    const html = render("not-admin");
    expect(html).toContain("This account is not an admin.");
    expect(html).toMatch(/<a[^>]*href="\/signout\/"[^>]*>.*Sign out.*<\/a>/);
    expect(html).not.toContain("the views");
  });

  it.each(["ready", "no-backend"] as const)("renders the views when %s", (access) => {
    const html = render(access);
    expect(html).toContain("the views");
    expect(html).not.toContain("Sign in");
  });
});
