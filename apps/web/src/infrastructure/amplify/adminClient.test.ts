import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStubApi } from "./adminStub.ts";
import { accessFor, getAdminApi, prepareAdminApi, setAdminApi } from "./adminClient.ts";

/** The session the deployed backend's binding reads, and the one generated client it is made over (client.ts). */
const session = vi.hoisted(() => ({
  groups: vi.fn<() => Promise<string[] | null>>(),
  graphql: vi.fn(async (_options: unknown): Promise<unknown> => ({ data: { getSubmission: null } })),
}));
vi.mock("./client.ts", () => ({
  sessionGroups: session.groups,
  amplifyGraphql: () => ({ graphql: session.graphql }),
}));

beforeEach(() => {
  session.groups.mockReset();
  session.graphql.mockClear();
});

afterEach(() => {
  setAdminApi(undefined);
  vi.unstubAllEnvs();
});

describe("getAdminApi", () => {
  it("has no backend unless one is bound or the stub is asked for", () => {
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "");
    expect(() => getAdminApi()).toThrow("not connected");
  });

  it("prepare binds nothing without the variable or the backend's outputs", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "");
    vi.stubEnv("CRV_AMPLIFY_OUTPUTS", "");
    expect(await prepareAdminApi()).toBe("no-backend");
    expect(() => getAdminApi()).toThrow("not connected");
    expect(session.groups).not.toHaveBeenCalled();
  });

  it("returns a bound backend, and the stub when asked for", async () => {
    const api = createStubApi();
    setAdminApi(api);
    expect(getAdminApi()).toBe(api);
    setAdminApi(undefined);
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "1");
    expect(await prepareAdminApi()).toBe("ready");
    expect(getAdminApi()).toBeDefined();
  });

  it("binds the stub over the outputs when both are there, and reads no session", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "1");
    vi.stubEnv("CRV_AMPLIFY_OUTPUTS", "{}");
    expect(await prepareAdminApi()).toBe("ready");
    expect((await getAdminApi().listSubmissions("new")).map((s) => s.id)).toEqual(["01STUB-S1"]);
    expect(session.groups).not.toHaveBeenCalled();
  });
});

describe("signing in to the deployed backend", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "");
    vi.stubEnv("CRV_AMPLIFY_OUTPUTS", "{}");
  });

  it("with no session, asks the visitor to sign in and binds nothing", async () => {
    session.groups.mockResolvedValue(null);
    expect(await prepareAdminApi()).toBe("signed-out");
    expect(() => getAdminApi()).toThrow("not connected");
  });

  it("treats a session that cannot be read as no session", async () => {
    session.groups.mockRejectedValue(new Error("refresh refused"));
    expect(await prepareAdminApi()).toBe("signed-out");
  });

  it("signed in without the admins group, says so and binds nothing", async () => {
    session.groups.mockResolvedValue([]);
    expect(await prepareAdminApi()).toBe("not-admin");
    expect(() => getAdminApi()).toThrow("not connected");
    session.groups.mockResolvedValue(["crv-triggers-only"]);
    expect(await prepareAdminApi()).toBe("not-admin");
  });

  it("an admin gets the deployed backend, called with the user pool", async () => {
    session.groups.mockResolvedValue(["admins"]);
    expect(await prepareAdminApi()).toBe("ready");
    expect(await getAdminApi().getSubmission("S1")).toBeNull();
    expect(session.graphql).toHaveBeenCalledWith(
      expect.objectContaining({ authMode: "userPool", variables: { id: "S1" } }),
    );
  });

  it("decides by the group alone", () => {
    expect(accessFor(null)).toBe("signed-out");
    expect(accessFor([])).toBe("not-admin");
    expect(accessFor(["admins"])).toBe("ready");
    expect(accessFor(["other", "admins"])).toBe("ready");
  });
});
