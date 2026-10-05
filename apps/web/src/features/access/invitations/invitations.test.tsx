import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Invitation } from "../../../infrastructure/amplify/api.ts";
import { InvitationsTable } from "./InvitationsTable.tsx";
import { actionsFor, mailtoHref, validateInvite } from "./model.ts";

const none = { revoke() {}, restore() {}, setGrants() {}, rebind() {}, deletePerson() {} };
const inv = (over: Partial<Invitation>): Invitation => ({
  email: "dee@example.com",
  personId: "P1",
  status: "accepted",
  statusAt: "2026-10-01T00:00:00Z",
  bound: true,
  invitedBy: "A",
  invitedAt: "2026-10-01T00:00:00Z",
  sites: ["driftline.app"],
  ...over,
});

describe("invitation model", () => {
  it("validates the address and the sites", () => {
    expect(validateInvite({ email: "nope", sites: ["driftline.app"] })?.field).toBe("email");
    expect(validateInvite({ email: "a@b.co", sites: [] })?.field).toBe("sites");
    expect(validateInvite({ email: " a@b.co ", sites: ["streamlane.app"] })).toBeUndefined();
  });

  it("builds a mail link that encodes the text", () => {
    expect(mailtoHref(" a@b.co ", "Hi & bye\nline")).toBe("mailto:a%40b.co?body=Hi%20%26%20bye%0Aline");
  });

  it("offers rebind only when bound, and restore only when revoked", () => {
    expect(actionsFor({ status: "accepted", bound: true })).toEqual({ revoke: true, restore: false, rebind: true });
    expect(actionsFor({ status: "revoked", bound: false })).toEqual({ revoke: false, restore: true, rebind: false });
    expect(actionsFor({ status: "pending", bound: false })).toEqual({ revoke: true, restore: false, rebind: false });
  });
});

describe("InvitationsTable", () => {
  const render = (rows: Invitation[]) =>
    renderToStaticMarkup(
      <MantineProvider>
        <InvitationsTable rows={rows} actions={none} />
      </MantineProvider>,
    );

  it("shows status and sites, and each destructive action is behind its first click", () => {
    const html = render([inv({})]);
    expect(html).toContain("dee@example.com");
    expect(html).toContain("Bound to a sign-in");
    expect(html).toContain("Revoke");
    expect(html).toContain("Delete person");
    // The question a second click answers is not on the page until the first click opens it.
    expect(html).not.toContain("Delete this person and everything held about them");
    expect(html).not.toContain("Revoke dee@example.com");
  });

  it("offers Restore for a revoked invitation", () => {
    const html = render([inv({ status: "revoked", bound: false })]);
    expect(html).toContain("Restore");
    expect(html).not.toContain(">Rebind<");
  });

  it("says so when empty", () => {
    expect(render([])).toContain("No invitations with this status.");
  });
});
