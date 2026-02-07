import { NODE_FIELD_DEFINITIONS } from "@/fixtures/nodes";
import type { FieldConfig } from "@/types/editor";
import type { WorkflowNodeType } from "@/types/nodes";

export function getNestedFieldConfig(
  nodeFields: Record<string, FieldConfig>,
  key: string
) {
  const foundKey = Object.keys(nodeFields).find(
    (k) => k === key || k.startsWith(key + ".")
  );

  return foundKey ? { key: foundKey, config: nodeFields[foundKey] } : null;
}

export function getValueByNestedPath<T>(
  obj: Record<string, unknown>,
  path: string
): T | undefined {
  const keys = path.split(".");

  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || typeof current !== "object" || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current as T;
}

export function updateStateByNestedPath<T>(
  prev: Record<string, unknown>,
  path: string,
  value: T
) {
  if (!path.includes(".")) {
    return { ...prev, [path]: value };
  }

  const clone = structuredClone(prev);
  const keys = path.split(".");
  const rootKey = keys[0];

  const rootObj = getValueByNestedPath<Record<string, unknown>>(clone, rootKey);

  const base =
    rootObj && typeof rootObj === "object"
      ? structuredClone(rootObj)
      : ({} as Record<string, unknown>);

  let current: unknown = base;

  for (let i = 1; i < keys.length - 1; i++) {
    const key = keys[i];

    if (typeof current !== "object" || current === null) break;

    const container = current as Record<string, unknown>;

    if (typeof container[key] !== "object" || container[key] === null) {
      container[key] = {};
    }

    current = container[key];
  }

  const lastKey = keys[keys.length - 1];

  if (typeof current === "object" && current !== null) {
    (current as Record<string, unknown>)[lastKey] = value;
  }

  clone[rootKey] = base;
  return clone;
}

/**
 * Get field config for a specific node type and field key
 * This is the PRIMARY method - always try this first
 */
export function getFieldConfig(
  nodeType: WorkflowNodeType,
  key: string
): { key: string; config: FieldConfig } | null {
  const nodeFields = NODE_FIELD_DEFINITIONS[nodeType];

  if (!nodeFields) return null;
  return getNestedFieldConfig(nodeFields, key);
}
