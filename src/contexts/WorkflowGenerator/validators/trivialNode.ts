import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "../../../types/ai/validators";
import {
  getExecutionConfig,
  extractInputDataReferences,
} from "../utils/validationUtils";

/**
 * Detect decision nodes that have non-null inputData but whose
 * functionCode never references any inputData field.
 *
 * Decision nodes MUST derive their boolean return value from inputData.
 * If inputData is non-null but functionCode ignores it entirely, the node
 * is returning a hardcoded boolean — which defeats the purpose of branching.
 *
 * Task nodes are excluded: they support trigger-style (inputData: null) and
 * action-style (performs side-effect, may not use inputData) patterns.
 */
export function validateTrivialNodes(nodes: WorkflowNode[]): ValidationResult {
  const violations = nodes.filter((node) => {
    if (node.type !== "decision") return false;

    const config = getExecutionConfig(node);
    if (!config) return false;

    const inputData = config.nodeData?.inputData;
    // Skip nodes that legitimately have no input (start node children)
    if (inputData === null || inputData === undefined) return false;

    const functionCode = config.functionCode ?? "";
    if (!functionCode.trim()) return false; // missing functionCode caught by other validator

    const refs = extractInputDataReferences(functionCode);
    return refs.size === 0; // has inputData but functionCode ignores it entirely
  });

  if (violations.length === 0) return { valid: true };

  const details = violations
    .map((n) => {
      const config = getExecutionConfig(n);
      return `"${n.data.title ?? n.id}" (${n.id}): has inputData=${JSON.stringify(config?.nodeData?.inputData)} but functionCode never references it`;
    })
    .join(" | ");

  return {
    valid: false,
    errorType: "TASK_NODE_IGNORES_INPUTDATA",
    errorMessage: details,
    affectedNodes: violations,
    metadata: { violations },
  };
}
