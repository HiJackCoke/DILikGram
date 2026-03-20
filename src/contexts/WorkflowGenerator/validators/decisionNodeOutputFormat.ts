import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";

/**
 * Validate that Decision node outputData is a boolean sample (not an object).
 *
 * Decision nodes must return a plain boolean from their functionCode.
 * Having an object in outputData indicates the old/wrong `return { ...inputData, success }` pattern.
 */
export function validateDecisionNodeOutputFormat(
  nodes: WorkflowNode[],
): ValidationResult {
  const violations = nodes.filter((n) => {
    if (n.type !== "decision") return false;
    const config = getExecutionConfig(n);
    const outputData = config?.nodeData?.outputData;
    // Valid: boolean (true/false) or null/undefined (no sample set yet)
    // Invalid: object (indicates wrong return format)
    return (
      outputData !== null &&
      outputData !== undefined &&
      typeof outputData === "object"
    );
  });

  if (violations.length === 0) {
    return { valid: true };
  }

  const errorMessage = violations
    .map((n) => {
      const config = getExecutionConfig(n);
      const outputData = config?.nodeData?.outputData;
      return (
        `Decision node "${n.data.title ?? "Untitled"}" (${n.id}) ` +
        `outputData must be boolean (true/false), got: ${JSON.stringify(outputData)}`
      );
    })
    .join(" | ");

  console.group("[DecisionNodeOutputFormat] Violation detected");
  console.log("violations:", violations.map((n) => n.id));
  console.log("errorMessage:", errorMessage);
  console.groupEnd();

  return {
    valid: false,
    errorType: "DECISION_NODE_OUTPUT_FORMAT",
    errorMessage,
    affectedNodes: violations,
  };
}
