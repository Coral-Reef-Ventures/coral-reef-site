"use client";

import { useCallback, useEffect, useState } from "react";

export type Loaded<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

/** Runs `load` on mount and whenever `deps` change; `reload` runs it again after a change the view made. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): [Loaded<T>, () => void] {
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  const [tick, setTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caller names the dependencies; `tick` is the reload.
  useEffect(() => {
    let live = true;
    setResult((r) => (r.state === "ready" ? r : { state: "loading" }));
    load().then(
      (data) => live && setResult({ state: "ready", data }),
      (error: unknown) => live && setResult({ state: "error", message: messageOf(error) }),
    );
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
