"use client";

import { useCallback, useEffect, useState } from "react";

export type Loaded<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

/**
 * Runs `load` once and reports what came of it. A load that throws before it has a promise to return (getAdminApi()
 * does, in a build with no backend) is reported as an error like a rejected one: called bare inside an effect, that
 * throw would escape React and take the whole page down instead of showing the view's error notice.
 */
export function runLoad<T>(load: () => Promise<T>, report: (result: Loaded<T>) => void): Promise<void> {
  return Promise.resolve()
    .then(load)
    .then(
      (data) => report({ state: "ready", data }),
      (error: unknown) => report({ state: "error", message: messageOf(error) }),
    );
}

/** Runs `load` on mount and whenever `deps` change; `reload` runs it again after a change the view made. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): [Loaded<T>, () => void] {
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  const [tick, setTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caller names the dependencies; `tick` is the reload.
  useEffect(() => {
    let live = true;
    setResult((r) => (r.state === "ready" ? r : { state: "loading" }));
    void runLoad(load, (next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return [result, reload];
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
