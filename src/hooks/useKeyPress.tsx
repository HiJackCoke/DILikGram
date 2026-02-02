import { useEffect, useRef } from "react";

interface UseKeyPressOptions {
  target?: Window | Document | HTMLElement;
  preventDefault?: boolean;
  enabled?: boolean;
}

function normalizeKey(key: string) {
  return key.toLowerCase();
}

export default function useKeyPress(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: UseKeyPressOptions = {}
) {
  const { target = typeof window !== 'undefined' ? window : undefined, preventDefault = false, enabled = true } = options;

  const callbackRef = useRef(callback);
  const normalizedKey = normalizeKey(key);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !target) return;

    const handler = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;

      if (normalizeKey(event.key) !== normalizedKey) return;

      if (preventDefault) {
        event.preventDefault();
      }

      callbackRef.current(event);
    };

    target.addEventListener("keydown", handler);
    return () => {
      target.removeEventListener("keydown", handler);
    };
  }, [normalizedKey, target, preventDefault, enabled]);
}
