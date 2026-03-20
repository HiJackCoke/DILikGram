import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";

/**
 * Detect task nodes that are missing functionCode entirely.
 *
 * functionCode is always required for task nodes regardless of outputData shape:
 *   - task nodes need it for data-processing, trigger-style, and action-style patterns
 *
 * group nodes are excluded (they use initFunctionCode instead).
 * service nodes are excluded (handled by serviceNodeFunctionCode validator).
 * decision nodes are excluded (functionCode is AUTO-GENERATED from data.condition
 *   by applyDeterministicCodeGeneration — no AI generation needed).
 */
export function validateFunctionCodeRequired(
  nodes: WorkflowNode[],
): ValidationResult {
  const violations = nodes.filter((node) => {
    if (!node.type || node.type !== "task") return false;

    const config = getExecutionConfig(node);
    return !config?.functionCode?.trim();
  });

  if (violations.length === 0) return { valid: true };

  const details = violations
    .map((n) => `"${n.data.title ?? n.id}" (type=${n.type}, id=${n.id})`)
    .join("; ");

  return {
    valid: false,
    errorType: "FUNCTION_CODE_REQUIRED",
    errorMessage: `${violations.length} node(s) are missing functionCode: ${details}`,
    affectedNodes: violations,
    metadata: { violations },
  };
}
