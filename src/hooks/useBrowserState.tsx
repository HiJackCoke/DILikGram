 
"use client";

import { useSyncExternalStore, useCallback, useRef } from "react";

type BrowserStateGetter<T> = () => T;

/**
 * SSR-safe state hook that syncs with browser-only values
 *
 * Unlike useBrowserEnv (read-only), this provides a setter like useState
 *
 * @param getter - Function to get current value (client-side only)
 * @param fallback - Fallback value for SSR
 * @returns [value, setValue] tuple like useState
 */
export function useBrowserState<T>(
  getter: BrowserStateGetter<T>,
  fallback: T
): [T, (newValue: T | ((prev: T) => T)) => void] {
  // Store for holding current value and listeners
  const storeRef = useRef<{
    value: T;
    listeners: Set<() => void>;
    initialized: boolean;
  }>({
    value: fallback,
    listeners: new Set(),
    initialized: false,
  });

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback((listener: () => void) => {
    storeRef.current.listeners.add(listener);
    return () => {
      storeRef.current.listeners.delete(listener);
    };
  }, []);

  // Get snapshot (client-side)
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") {
      return fallback;
    }

    // First time: get value from getter
    if (!storeRef.current.initialized) {
      storeRef.current.value = getter();
      storeRef.current.initialized = true;
    }

    return storeRef.current.value;
  }, [getter, fallback]);

  // Get server snapshot (SSR)
  const getServerSnapshot = useCallback(() => {
    return fallback;
  }, [fallback]);

  // Get current value via useSyncExternalStore
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Setter function (like useState)
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof window === "undefined") return;

    const nextValue =
      typeof newValue === "function"
        ? (newValue as (prev: T) => T)(storeRef.current.value)
        : newValue;

    storeRef.current.value = nextValue;

    // Notify all listeners to trigger re-render
    storeRef.current.listeners.forEach((listener) => listener());
  }, []);

  return [value, setValue];
}
