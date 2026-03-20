import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "../../../types/ai/validators";

/**
 * Validate that every GroupNode has at least 2 non-decision child nodes.
 * A GroupNode with only 1 child provides no value as a container.
 */
export function validateGroupNodeMinChildren(
  nodes: WorkflowNode[],
): ValidationResult {
  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );

  // Count non-decision children per group
  const childCount: Record<string, number> = {};
  nodes.forEach((n) => {
    if (n.parentNode && groupNodeIds.has(n.parentNode) && n.type !== "decision") {
      childCount[n.parentNode] = (childCount[n.parentNode] ?? 0) + 1;
    }
  });

  const violations = nodes.filter(
    (n) => n.type === "group" && (childCount[n.id] ?? 0) < 2,
  );

  if (violations.length === 0) {
    return { valid: true };
  }

  const errorMessage = violations
    .map((n) => {
      const count = childCount[n.id] ?? 0;
      return `GroupNode "${n.data.title ?? "Untitled"}" (${n.id}) has only ${count} child node(s); minimum is 2.`;
    })
    .join(" | ");

  console.group("[GroupNodeMinChildren] Violation detected");
  console.log("affected GroupNode IDs:", violations.map((n) => n.id));
  console.log("errorMessage:", errorMessage);
  console.groupEnd();

  // Include both the group nodes and their existing children as affected nodes
  const affectedChildNodes = nodes.filter(
    (n) =>
      n.parentNode &&
      violations.some((g) => g.id === n.parentNode) &&
      n.type !== "decision",
  );
  const affectedNodes = [
    ...violations,
    ...affectedChildNodes,
  ].filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i);

  return {
    valid: false,
    errorType: "GROUP_NODE_MIN_CHILDREN",
    errorMessage,
    affectedNodes,
  };
}
