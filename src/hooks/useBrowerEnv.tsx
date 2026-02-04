/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSyncExternalStore, useRef } from "react";

type BrowserSelector<T> = (env: { window: Window; document: Document }) => T;

function subscribe(_onStoreChange: () => void) {
  return () => {};
}

function getServerSnapshot<T>(fallback: T) {
  return fallback;
}

// Deep equality check for preventing infinite loops
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

export function useBrowserEnv<T>(selector: BrowserSelector<T>, fallback: T): T {
  const cacheRef = useRef<{ value: T; initialized: boolean }>({
    value: fallback,
    initialized: false,
  });

  return useSyncExternalStore(
    subscribe,
    () => {
      // Client-side snapshot
      if (typeof window === "undefined") {
        return fallback;
      }

      const newValue = selector({ window, document });

      if (
        !cacheRef.current.initialized ||
        !deepEqual(cacheRef.current.value, newValue)
      ) {
        cacheRef.current = {
          value: newValue,
          initialized: true,
        };
      }

      return cacheRef.current.value;
    },
    () => getServerSnapshot(fallback),
  );
}
