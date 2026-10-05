import { afterEach, describe, expect, it } from "vitest";
import { getAdminApi, setAdminApi } from "../../../infrastructure/amplify/adminClient.ts";
import { createStubApi } from "../../../infrastructure/amplify/adminStub.ts";
import { type Loaded, runLoad } from "./useLoad.ts";

afterEach(() => setAdminApi(undefined));

const collect = async <T>(load: () => Promise<T>): Promise<Loaded<T>[]> => {
  const seen: Loaded<T>[] = [];
  await runLoad(load, (result) => seen.push(result));
  return seen;
};

describe("runLoad", () => {
  it("reports an error, rather than throwing, when no backend is bound", async () => {
    // Each view's load is `() => getAdminApi().listX()`, which throws before any promise exists.
    setAdminApi(undefined);
    const seen = await collect(() => getAdminApi().listSubmissions("new"));
    expect(seen).toEqual([{ state: "error", message: "The admin backend is not connected in this build." }]);
  });

  it("reports a rejected load as an error, and a non-Error as a plain message", async () => {
    expect(await collect(() => Promise.reject(new Error("NOT_FOUND")))).toEqual([
      { state: "error", message: "NOT_FOUND" },
    ]);
    expect(await collect(() => Promise.reject("odd"))).toEqual([{ state: "error", message: "Something went wrong." }]);
  });

  it("reports the data once the backend answers", async () => {
    setAdminApi(createStubApi(() => new Date("2026-10-05T12:00:00Z")));
    const seen = await collect(() => getAdminApi().listSubmissions("new"));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.state).toBe("ready");
  });
});
