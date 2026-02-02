"use client";

import { useSyncExternalStore } from "react";

type BrowserSelector<T> = (env: { window: Window; document: Document }) => T;

function subscribe(_onStoreChange: () => void) {
  return () => {};
}

function getServerSnapshot<T>(fallback: T) {
  return fallback;
}

export function useBrowserEnv<T>(selector: BrowserSelector<T>, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector({ window, document }),
    () => getServerSnapshot(fallback)
  );
}
