import { useEffect, useCallback } from "react";

type KeyHandler = (event: KeyboardEvent) => void;
type KeyMap = Record<string, KeyHandler>;

interface UseGlobalKeyHandlerOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  target?: Window | Document | HTMLElement;
  ignoreInputFields?: boolean; // input, textarea에서 무시
}

/**
 * Parse key combination string into KeyboardEvent properties
 * Examples: "Ctrl+C", "Cmd+V", "Delete", "Shift+Delete"
 */
function parseKeyCombo(combo: string) {
  const parts = combo.split("+").map((p) => p.trim());
  const key = parts[parts.length - 1].toLowerCase();

  return {
    key,
    ctrl: parts.includes("Ctrl"),
    meta: parts.includes("Cmd") || parts.includes("Meta"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
  };
}

/**
 * Check if KeyboardEvent matches the key combination
 */
function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const expected = parseKeyCombo(combo);
  const actualKey = event.key.toLowerCase();

  // Match key
  if (actualKey !== expected.key) return false;

  // Match modifiers
  if (event.ctrlKey !== expected.ctrl) return false;
  if (event.metaKey !== expected.meta) return false;
  if (event.shiftKey !== expected.shift) return false;
  if (event.altKey !== expected.alt) return false;

  return true;
}

/**
 * Check if event target is an input field
 */
function isInputField(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable
  );
}

/**
 * Global keyboard shortcut handler hook
 *
 * @example
 * // Single shortcut
 * useGlobalKeyHandler("Ctrl+C", handleCopy);
 *
 * @example
 * // Multiple shortcuts
 * useGlobalKeyHandler({
 *   "Ctrl+C": handleCopy,
 *   "Ctrl+V": handlePaste,
 *   "Delete": handleDelete,
 * });
 *
 * @example
 * // With options
 * useGlobalKeyHandler(
 *   { "Ctrl+C": handleCopy },
 *   { enabled: isEditing, preventDefault: true }
 * );
 */
export function useGlobalKeyHandler(
  keyMapOrCombo: KeyMap | string,
  handlerOrOptions?: KeyHandler | UseGlobalKeyHandlerOptions,
  options?: UseGlobalKeyHandlerOptions
) {
  // Parse arguments (overloaded function)
  let keyMap: KeyMap;
  let opts: UseGlobalKeyHandlerOptions;

  if (typeof keyMapOrCombo === "string") {
    // Single key: useGlobalKeyHandler("Ctrl+C", handler, options)
    keyMap = { [keyMapOrCombo]: handlerOrOptions as KeyHandler };
    opts = options || {};
  } else {
    // Multiple keys: useGlobalKeyHandler({ ... }, options)
    keyMap = keyMapOrCombo;
    opts = (handlerOrOptions as UseGlobalKeyHandlerOptions) || {};
  }

  const {
    enabled = true,
    preventDefault = true,
    target = window,
    ignoreInputFields = true,
  } = opts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if input field (optional)
      if (ignoreInputFields && isInputField(event.target)) {
        return;
      }

      // Find matching key combination
      for (const [combo, handler] of Object.entries(keyMap)) {
        if (matchesKeyCombo(event, combo)) {
          if (preventDefault) {
            event.preventDefault();
          }
          handler(event);
          break; // Only execute first match
        }
      }
    },
    [keyMap, preventDefault, ignoreInputFields]
  );

  useEffect(() => {
    if (!enabled) return;

    target.addEventListener("keydown", handleKeyDown as EventListener);
    return () => {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  }, [enabled, target, handleKeyDown]);
}
