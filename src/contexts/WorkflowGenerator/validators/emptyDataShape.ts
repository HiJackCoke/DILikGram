import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";

/**
 * Returns true if value contains an empty object or under-populated array.
 * Checks recursively.
 *
 * Rules:
 *  - object (non-null): must have >= 1 key
 *  - array: must have >= 3 elements
 *  - null/undefined/primitive: allowed
 */
function hasEmptyDataShape(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false; // primitives are fine

  if (Array.isArray(value)) {
    if (value.length < 3) return true;
    return value.some((item) => hasEmptyDataShape(item));
  }

  // Plain object
  const keys = Object.keys(value as object);
  if (keys.length === 0) return true;
  return Object.values(value as object).some((v) => hasEmptyDataShape(v));
}

/**
 * Validates that no node has empty objects or under-populated arrays
 * in inputData or outputData, since they prevent accurate type inference.
 */
export function validateEmptyDataShape(
  nodes: WorkflowNode[],
): ValidationResult {
  const violations: { node: WorkflowNode; field: "inputData" | "outputData" }[] = [];

  for (const node of nodes) {
    const config = getExecutionConfig(node);
    if (!config) continue;

    const { inputData, outputData } = config.nodeData ?? {};

    if (hasEmptyDataShape(inputData)) {
      violations.push({ node, field: "inputData" });
    }
    if (hasEmptyDataShape(outputData)) {
      violations.push({ node, field: "outputData" });
    }
  }

  if (violations.length === 0) return { valid: true };

  const details = violations
    .map(({ node, field }) => {
      const config = getExecutionConfig(node);
      const val =
        field === "inputData"
          ? config?.nodeData?.inputData
          : config?.nodeData?.outputData;
      return `"${node.data.title ?? node.id}" (${field}=${JSON.stringify(val)})`;
    })
    .join("; ");

  return {
    valid: false,
    errorType: "EMPTY_DATA_SHAPE",
    errorMessage: `${violations.length} node(s) have empty objects/arrays in inputData or outputData (cannot infer types): ${details}`,
    affectedNodes: violations.map((v) => v.node),
    metadata: { violations: violations.map((v) => ({ nodeId: v.node.id, field: v.field })) },
  };
}
