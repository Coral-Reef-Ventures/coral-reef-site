import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubApi } from "./adminStub.ts";
import { getAdminApi, prepareAdminApi, setAdminApi } from "./adminClient.ts";

afterEach(() => {
  setAdminApi(undefined);
  vi.unstubAllEnvs();
});

describe("getAdminApi", () => {
  it("has no backend unless one is bound or the stub is asked for", () => {
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "");
    expect(() => getAdminApi()).toThrow("not connected");
  });

  it("prepare binds nothing without the variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "");
    await prepareAdminApi();
    expect(() => getAdminApi()).toThrow("not connected");
  });

  it("returns a bound backend, and the stub when asked for", async () => {
    const api = createStubApi();
    setAdminApi(api);
    expect(getAdminApi()).toBe(api);
    setAdminApi(undefined);
    vi.stubEnv("NEXT_PUBLIC_CRV_ADMIN_STUB", "1");
    await prepareAdminApi();
    expect(getAdminApi()).toBeDefined();
  });
});
