import { describe, expect, it, vi } from "vitest";
import { createAmplifyAdminApi, errorCode, type GraphqlClient, MAX_PAGES, MAX_ROWS } from "./adminAmplify.ts";

/**
 * The AdminApi over the deployed backend, with the generated client's one call mocked: for each method, the document it
 * sends (by its operation and root field), the variables, the auth mode, and how the answer is shaped for the views.
 * amplify/data/client-documents.test.ts holds the same documents to the synthesized schema.
 */

type Sent = { query: string; variables: Record<string, unknown>; authMode: string };
type Answer = (sent: Sent) => unknown;

/** A client that answers by root field, and records what was sent. */
const mock = (answers: Record<string, Answer>) => {
  const sent: (Sent & { field: string })[] = [];
  const client: GraphqlClient = {
    graphql: vi.fn(async (options) => {
      const sentOptions = options as Sent;
      const field = /\{\s*(\w+)/.exec(sentOptions.query)?.[1] ?? "";
      sent.push({ ...sentOptions, field });
      const answer = answers[field];
      if (!answer) throw new Error(`no answer for ${field}`);
      return { data: { [field]: answer(sentOptions) } };
    }),
  };
  return { api: createAmplifyAdminApi(client), sent, client };
};

const rawSubmission = (over: Record<string, unknown> = {}) => ({
  id: "S1",
  name: "Ada Example",
  email: "ada@example.com",
  organization: null,
  interests: ["funding"],
  message: "Hello.",
  sourceSite: "crv",
  status: "new",
  statusAt: "2026-10-03T12:00:00.000Z",
  notes: null,
  receivedAt: "2026-10-03T12:00:00.000Z",
  reviewedBy: null,
  reviewedAt: null,
  personId: null,
  ...over,
});

const rawView = (over: Record<string, unknown> = {}) => ({
  email: "eli@example.com",
  personId: "P2",
  submissionId: null,
  status: "pending",
  statusAt: "2026-10-04T12:00:00.000Z",
  bound: false,
  invitedBy: "P0",
  invitedAt: "2026-10-04T12:00:00.000Z",
  acceptedAt: null,
  revokedAt: null,
  note: null,
  sites: ["driftline.app"],
  ...over,
});

const rawInvitation = (over: Record<string, unknown> = {}) => {
  const { bound: _bound, sites: _sites, ...rest } = rawView();
  return { ...rest, cognitoSub: null, ...over };
};

const rawActivity = (id: string, at: string, over: Record<string, unknown> = {}) => ({
  id,
  personId: null,
  actorId: "system",
  area: "interest",
  kind: "interest.submitted",
  subjectType: "Submission",
  subjectId: "S1",
  at,
  detail: null,
  ...over,
});

const page = (items: unknown[], nextToken: string | null = null) => ({ items, nextToken });

describe("every call", () => {
  it("is made with the user pool and sends no undefined variable", async () => {
    const { api, sent } = mock({ updateSubmission: () => rawSubmission() });
    await api.updateSubmission({ id: "S1", notes: "Call booked" });
    expect(sent[0]?.authMode).toBe("userPool");
    expect(sent[0]?.variables).toEqual({ id: "S1", notes: "Call booked" });
    expect(sent[0]?.query).toContain("mutation UpdateSubmission(");
  });

  it("turns a refusal into its code, and anything else into a code that carries no value", async () => {
    const refusing = (errors: unknown): GraphqlClient => ({
      graphql: async () => {
        throw { data: null, errors };
      },
    });
    const refused = createAmplifyAdminApi(refusing([{ message: "ALREADY_BOUND", errorType: "Lambda:Unhandled" }]));
    await expect(refused.invite({ email: "a@b.co", sites: ["driftline.app"] })).rejects.toThrow(/^ALREADY_BOUND$/);
    const denied = createAmplifyAdminApi(
      refusing([
        { message: "Not Authorized to access listInvitationsByStatus on type Query", errorType: "Unauthorized" },
      ]),
    );
    await expect(denied.listInvitations("pending")).rejects.toThrow(/^UNAUTHORIZED$/);
    const quoting = createAmplifyAdminApi(
      refusing([{ message: "Variable 'email' has an invalid value: secret@example.com", errorType: "BadRequest" }]),
    );
    await expect(quoting.eraseEmail("secret@example.com")).rejects.toThrow(/^REQUEST_FAILED$/);
  });

  it("names a missing session SIGNED_OUT and a network failure REQUEST_FAILED", () => {
    expect(errorCode(Object.assign(new Error("No current user"), { name: "NoSignedUser" }))).toBe("SIGNED_OUT");
    expect(errorCode(Object.assign(new Error("x"), { name: "NoValidAuthTokens" }))).toBe("SIGNED_OUT");
    expect(errorCode({ errors: [{ message: "Network error" }] })).toBe("REQUEST_FAILED");
    expect(errorCode("odd")).toBe("REQUEST_FAILED");
  });

  it("fails with a code when an answer has errors or no data", async () => {
    const withErrors = createAmplifyAdminApi({
      graphql: async () => ({ data: { getSubmission: null }, errors: [{ message: "CONFLICT" }] }),
    });
    await expect(withErrors.getSubmission("S1")).rejects.toThrow(/^CONFLICT$/);
    const empty = createAmplifyAdminApi({ graphql: async () => ({}) });
    await expect(empty.getSubmission("S1")).rejects.toThrow(/^REQUEST_FAILED$/);
  });
});

describe("submissions", () => {
  it("lists one status by its index, newest first, with nulls left out as the stub leaves them", async () => {
    const { api, sent } = mock({
      listSubmissionsByStatus: () =>
        page([
          rawSubmission({ id: "S1", receivedAt: "2026-10-01T00:00:00.000Z" }),
          rawSubmission({
            id: "S2",
            receivedAt: "2026-10-02T00:00:00.000Z",
            organization: "Example Capital",
            notes: "Replied once.",
            reviewedBy: "P0",
            reviewedAt: "2026-10-02T01:00:00.000Z",
            personId: "P9",
          }),
        ]),
    });
    const rows = await api.listSubmissions("new");
    expect(sent.map((s) => s.field)).toEqual(["listSubmissionsByStatus"]);
    expect(sent[0]?.variables).toEqual({ status: "new", sortDirection: "DESC", limit: 100 });
    expect(rows.map((r) => r.id)).toEqual(["S2", "S1"]);
    expect(rows[1]).toEqual({
      id: "S1",
      name: "Ada Example",
      email: "ada@example.com",
      organization: "",
      interests: ["funding"],
      message: "Hello.",
      sourceSite: "crv",
      status: "new",
      statusAt: "2026-10-03T12:00:00.000Z",
      notes: "",
      receivedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(Object.keys(rows[1] ?? {})).not.toContain("reviewedBy");
    expect(rows[0]).toMatchObject({
      organization: "Example Capital",
      notes: "Replied once.",
      reviewedBy: "P0",
      reviewedAt: "2026-10-02T01:00:00.000Z",
      personId: "P9",
    });
  });

  it("pages through nextToken", async () => {
    const tokens: unknown[] = [];
    const { api } = mock({
      listSubmissionsByStatus: ({ variables }) => {
        tokens.push(variables.nextToken);
        return variables.nextToken
          ? page([rawSubmission({ id: "S2", receivedAt: "2026-09-01T00:00:00.000Z" })])
          : page([rawSubmission({ id: "S1" })], "t1");
      },
    });
    expect((await api.listSubmissions("reviewing")).map((r) => r.id)).toEqual(["S1", "S2"]);
    expect(tokens).toEqual([undefined, "t1"]);
  });

  it("without a status, asks each status's index and merges them newest first", async () => {
    const { api, sent } = mock({
      listSubmissionsByStatus: ({ variables }) =>
        page(
          variables.status === "declined"
            ? [rawSubmission({ id: "D", status: "declined", receivedAt: "2026-10-04T00:00:00.000Z" })]
            : variables.status === "new"
              ? [rawSubmission({ id: "N", receivedAt: "2026-10-01T00:00:00.000Z" })]
              : [],
        ),
    });
    expect((await api.listSubmissions()).map((r) => r.id)).toEqual(["D", "N"]);
    expect(sent.map((s) => s.variables.status)).toEqual(["new", "reviewing", "invited", "declined", "archived"]);
  });

  it("stops at its caps however long the list runs", async () => {
    let calls = 0;
    const { api } = mock({
      listSubmissionsByStatus: () => {
        calls += 1;
        return page(
          Array.from({ length: 100 }, (_, i) => rawSubmission({ id: `S${calls}-${i}` })),
          "more",
        );
      },
    });
    expect((await api.listSubmissions("new")).length).toBe(MAX_ROWS);
    expect(calls).toBe(MAX_ROWS / 100);

    let empty = 0;
    const { api: sparse } = mock({
      listSubmissionsByStatus: () => {
        empty += 1;
        return page([], "more");
      },
    });
    expect(await sparse.listSubmissions("new")).toEqual([]);
    expect(empty).toBe(MAX_PAGES);
  });

  it("gets one by id, or null", async () => {
    const { api, sent } = mock({
      getSubmission: ({ variables }) => (variables.id === "S1" ? rawSubmission() : null),
    });
    expect((await api.getSubmission("S1"))?.name).toBe("Ada Example");
    expect(await api.getSubmission("nope")).toBeNull();
    expect(sent.map((s) => [s.field, s.variables])).toEqual([
      ["getSubmission", { id: "S1" }],
      ["getSubmission", { id: "nope" }],
    ]);
  });

  it("updates status and notes, sending only what was given, and returns the stored submission", async () => {
    const { api, sent } = mock({
      updateSubmission: ({ variables }) => rawSubmission({ status: variables.status ?? "new", notes: variables.notes }),
    });
    const updated = await api.updateSubmission({ id: "S1", status: "reviewing", notes: "Call booked" });
    expect(sent[0]?.variables).toEqual({ id: "S1", status: "reviewing", notes: "Call booked" });
    expect(updated).toMatchObject({ id: "S1", status: "reviewing", notes: "Call booked" });
    await api.updateSubmission({ id: "S1", status: "archived" });
    expect(sent[1]?.variables).toEqual({ id: "S1", status: "archived" });
  });

  it("refuses an update the backend answered with nothing", async () => {
    const { api } = mock({ updateSubmission: () => null });
    await expect(api.updateSubmission({ id: "S1", notes: "x" })).rejects.toThrow(/^NO_SUBMISSION$/);
  });
});

describe("invitations", () => {
  const grants: Record<string, unknown[]> = {
    "site:streamlane.app": [
      { personId: "P1", resource: "site:streamlane.app", status: "active" },
      { personId: "P2", resource: "site:streamlane.app", status: "revoked" },
    ],
    "site:driftline.app": [
      { personId: "P1", resource: "site:driftline.app", status: "active" },
      { personId: "P2", resource: "site:driftline.app", status: "active" },
    ],
  };

  it("lists by status, newest invited first, with sites from active grants and bound from cognitoSub", async () => {
    const { api, sent } = mock({
      listInvitationsByStatus: () =>
        page([
          rawInvitation({ email: "eli@example.com", personId: "P2", invitedAt: "2026-10-04T00:00:00.000Z" }),
          rawInvitation({
            email: "dee@example.com",
            personId: "P1",
            status: "accepted",
            cognitoSub: "sub-1",
            acceptedAt: "2026-10-05T00:00:00.000Z",
            invitedAt: "2026-10-05T00:00:00.000Z",
            note: "Design partner",
          }),
          rawInvitation({ email: "none@example.com", personId: null, invitedAt: "2026-10-01T00:00:00.000Z" }),
        ]),
      listAccessGrantsByResource: ({ variables }) => page(grants[String(variables.resource)] ?? []),
    });
    const rows = await api.listInvitations("pending");
    expect(sent.filter((s) => s.field === "listInvitationsByStatus").map((s) => s.variables)).toEqual([
      { status: "pending", sortDirection: "DESC", limit: 100 },
    ]);
    expect(sent.filter((s) => s.field === "listAccessGrantsByResource").map((s) => s.variables)).toEqual([
      { resource: "site:streamlane.app", filter: { status: { eq: "active" } }, limit: 1000 },
      { resource: "site:driftline.app", filter: { status: { eq: "active" } }, limit: 1000 },
    ]);
    expect(rows.map((r) => [r.email, r.bound, r.sites])).toEqual([
      ["dee@example.com", true, ["streamlane.app", "driftline.app"]],
      ["eli@example.com", false, ["driftline.app"]],
      ["none@example.com", false, []],
    ]);
    expect(rows[1]).toEqual({
      email: "eli@example.com",
      personId: "P2",
      status: "pending",
      statusAt: "2026-10-04T12:00:00.000Z",
      bound: false,
      invitedBy: "P0",
      invitedAt: "2026-10-04T00:00:00.000Z",
      sites: ["driftline.app"],
    });
    expect(rows[0]).toMatchObject({ acceptedAt: "2026-10-05T00:00:00.000Z", note: "Design partner" });
  });

  it("without a status, asks each status's index", async () => {
    const { api, sent } = mock({
      listInvitationsByStatus: () => page([]),
      listAccessGrantsByResource: () => page([]),
    });
    await api.listInvitations();
    expect(sent.filter((s) => s.field === "listInvitationsByStatus").map((s) => s.variables.status)).toEqual([
      "pending",
      "accepted",
      "revoked",
    ]);
  });

  it("invites with the sites and the submission, and returns the view and the text", async () => {
    const { api, sent } = mock({
      invite: () => ({
        invitation: rawView({
          email: "ada@example.com",
          submissionId: "S1",
          sites: ["driftline.app", "streamlane.app"],
        }),
        subject: "Your invitation to Streamlane and Driftline",
        text: "Hello, ada@example.com",
      }),
    });
    const result = await api.invite({ email: "ada@example.com", sites: ["streamlane.app"], submissionId: "S1" });
    expect(sent[0]?.field).toBe("invite");
    expect(sent[0]?.variables).toEqual({ email: "ada@example.com", sites: ["streamlane.app"], submissionId: "S1" });
    expect(result.text).toBe("Hello, ada@example.com");
    // In the registry's order, whatever order the backend sent.
    expect(result.invitation).toMatchObject({ email: "ada@example.com", submissionId: "S1", bound: false });
    expect(result.invitation.sites).toEqual(["streamlane.app", "driftline.app"]);
  });

  it.each([
    [
      "revokeInvitation",
      (api: ReturnType<typeof mock>["api"]) => api.revokeInvitation("eli@example.com"),
      { email: "eli@example.com" },
    ],
    [
      "restoreInvitation",
      (api: ReturnType<typeof mock>["api"]) => api.restoreInvitation("eli@example.com"),
      { email: "eli@example.com" },
    ],
    [
      "setGrants",
      (api: ReturnType<typeof mock>["api"]) => api.setGrants("eli@example.com", ["streamlane.app", "driftline.app"]),
      { email: "eli@example.com", sites: ["streamlane.app", "driftline.app"] },
    ],
    [
      "rebindInvitation",
      (api: ReturnType<typeof mock>["api"]) => api.rebindInvitation("dee@example.com", "dee@new.example"),
      { email: "dee@example.com", newEmail: "dee@new.example" },
    ],
    [
      "rebindInvitation",
      (api: ReturnType<typeof mock>["api"]) => api.rebindInvitation("dee@example.com"),
      { email: "dee@example.com" },
    ],
  ] as const)("%s sends its variables and maps the InvitationView", async (field, run, variables) => {
    const { api, sent } = mock({
      [field]: () => rawView({ status: "revoked", revokedAt: "2026-10-05T00:00:00.000Z", bound: true, sites: [] }),
    });
    const view = await run(api);
    expect(sent.map((s) => [s.field, s.variables])).toEqual([[field, variables]]);
    expect(view).toEqual({
      email: "eli@example.com",
      personId: "P2",
      status: "revoked",
      statusAt: "2026-10-04T12:00:00.000Z",
      bound: true,
      invitedBy: "P0",
      invitedAt: "2026-10-04T12:00:00.000Z",
      revokedAt: "2026-10-05T00:00:00.000Z",
      sites: [],
    });
  });

  it("deletes a person and erases an address", async () => {
    const { api, sent } = mock({ deletePerson: () => ({ ok: true }), eraseEmail: () => ({ ok: true }) });
    await expect(api.deletePerson("P1")).resolves.toBeUndefined();
    await expect(api.eraseEmail("ada@example.com")).resolves.toBeUndefined();
    expect(sent.map((s) => [s.field, s.variables])).toEqual([
      ["deletePerson", { personId: "P1" }],
      ["eraseEmail", { email: "ada@example.com" }],
    ]);
  });
});

describe("activity", () => {
  it("queries by subject, newest first, with the detail parsed and nulls left out", async () => {
    const { api, sent } = mock({
      listActivityBySubject: () =>
        page([
          rawActivity("A2", "2026-10-05T00:00:02.000Z", {
            kind: "interest.status_changed",
            detail: JSON.stringify({ from: "new", to: "reviewing" }),
          }),
          rawActivity("A1", "2026-10-05T00:00:01.000Z"),
        ]),
    });
    const rows = await api.listActivity({ subjectId: "S1" });
    expect(sent.map((s) => [s.field, s.variables])).toEqual([
      ["listActivityBySubject", { subjectId: "S1", sortDirection: "DESC", limit: 100 }],
    ]);
    expect(rows).toEqual([
      {
        id: "A2",
        actorId: "system",
        area: "interest",
        kind: "interest.status_changed",
        subjectType: "Submission",
        subjectId: "S1",
        at: "2026-10-05T00:00:02.000Z",
        detail: { from: "new", to: "reviewing" },
      },
      {
        id: "A1",
        actorId: "system",
        area: "interest",
        kind: "interest.submitted",
        subjectType: "Submission",
        subjectId: "S1",
        at: "2026-10-05T00:00:01.000Z",
      },
    ]);
  });

  it("queries by person, and by area with the limit asked for", async () => {
    const { api, sent } = mock({
      listActivityByPerson: () => page([rawActivity("A1", "2026-10-05T00:00:00.000Z", { personId: "P1" })]),
      listActivityByArea: () => page([rawActivity("A1", "2026-10-05T00:00:00.000Z", { area: "access" })]),
    });
    expect((await api.listActivity({ personId: "P1" }))[0]?.personId).toBe("P1");
    await api.listActivity({ area: "access", limit: 20 });
    expect(sent.map((s) => [s.field, s.variables])).toEqual([
      ["listActivityByPerson", { personId: "P1", sortDirection: "DESC", limit: 100 }],
      ["listActivityByArea", { area: "access", sortDirection: "DESC", limit: 20 }],
    ]);
  });

  it("with no key, merges every area newest first and keeps the limit", async () => {
    const { api, sent } = mock({
      listActivityByArea: ({ variables }) =>
        page(
          variables.area === "interest"
            ? [rawActivity("I2", "2026-10-05T00:00:04.000Z"), rawActivity("I1", "2026-10-05T00:00:01.000Z")]
            : variables.area === "access"
              ? [rawActivity("X1", "2026-10-05T00:00:03.000Z", { area: "access", kind: "access.invited" })]
              : [],
        ),
    });
    const rows = await api.listActivity({ limit: 2 });
    expect(sent.map((s) => s.variables.area)).toEqual(["interest", "access", "people", "door"]);
    expect(rows.map((r) => r.id)).toEqual(["I2", "X1"]);
  });

  it("applies a second condition to what the narrowest index returns, and caps the limit", async () => {
    const { api, sent } = mock({
      listActivityBySubject: () =>
        page([
          rawActivity("A2", "2026-10-05T00:00:02.000Z", { personId: "P2" }),
          rawActivity("A1", "2026-10-05T00:00:01.000Z", { personId: "P1" }),
        ]),
    });
    expect((await api.listActivity({ subjectId: "S1", personId: "P1" })).map((r) => r.id)).toEqual(["A1"]);
    await api.listActivity({ subjectId: "S1", limit: 10_000 });
    expect(sent[1]?.variables.limit).toBe(100);
  });

  it("leaves out a detail that is not an object", async () => {
    const { api } = mock({
      listActivityByArea: () => page([rawActivity("A1", "2026-10-05T00:00:00.000Z", { detail: "not json" })]),
    });
    expect((await api.listActivity({ area: "interest" }))[0]).not.toHaveProperty("detail");
  });
});
