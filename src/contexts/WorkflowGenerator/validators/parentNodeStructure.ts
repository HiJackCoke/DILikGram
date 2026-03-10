import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";

/**
 * Validate parent-child node structure
 *
 * Rules:
 * - At least ONE root node (no parentNode) must exist
 * - Multiple root nodes are allowed (for multi-page workflows with independent trees)
 * - All non-root nodes must have valid parentNode references
 * - parentNode must point to an existing node in the workflow
 */
export function validateParentNodeStructure(
  nodes: WorkflowNode[],
): ValidationResult {
  if (nodes.length === 0) {
    return { valid: true };
  }

  const rootNodes = nodes.filter((n) => !n.parentNode);
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Check 1: Must have at least one root node
  if (rootNodes.length === 0) {
    return {
      valid: false,
      errorType: "NO_ROOT_NODE",
      errorMessage: "No root node found. All nodes have parentNode.",
      affectedNodes: [],
    };
  }

  // Check 2: All non-root nodes must have valid parentNode references
  const invalidNodes: WorkflowNode[] = [];

  for (const node of nodes) {
    if (node.parentNode && !nodeIds.has(node.parentNode)) {
      invalidNodes.push(node);
    }
  }

  if (invalidNodes.length > 0) {
    return {
      valid: false,
      errorType: "INVALID_PARENT_REFERENCES",
      errorMessage: `Found ${invalidNodes.length} nodes with invalid parentNode references`,
      affectedNodes: invalidNodes,
    };
  }

  return { valid: true };
}

/**
 * Repair parent-child node structure
 *
 * Strategies:
 * - No root nodes: Make first node the root
 * - Invalid parentNode: Connect to root node
 */
export async function repairParentNodeStructure(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  const workingNodes = [...context.nodes];

  const result = validateParentNodeStructure(workingNodes);
  if (result.valid) {
    return workingNodes;
  }

  console.log(
    `[parentNodeStructure] Repairing: ${result.errorType} - ${result.errorMessage}`,
  );

  // Case 1: No root nodes → make first node root
  if (result.errorType === "NO_ROOT_NODE") {
    console.log(
      `[parentNodeStructure] Making first node root (removing its parentNode)`,
    );

    if (workingNodes.length > 0) {
      workingNodes[0] = {
        ...workingNodes[0],
        parentNode: undefined,
      };
    }
  }

  // Case 3: Invalid parentNode references → connect to root
  if (result.errorType === "INVALID_PARENT_REFERENCES") {
    const rootNodes = workingNodes.filter((n) => !n.parentNode);
    const rootNode = rootNodes[0];

    if (!rootNode) {
      console.warn(
        `[parentNodeStructure] No root node found for fixing invalid references`,
      );
      return workingNodes;
    }

    const nodeIds = new Set(workingNodes.map((n) => n.id));

    console.log(
      `[parentNodeStructure] Fixing invalid parentNode references (connecting to root: ${rootNode.id})`,
    );

    for (let i = 0; i < workingNodes.length; i++) {
      const node = workingNodes[i];

      // Skip root node
      if (!node.parentNode) continue;

      // If parentNode doesn't exist, connect to root
      if (!nodeIds.has(node.parentNode)) {
        workingNodes[i] = {
          ...workingNodes[i],
          parentNode: rootNode.id,
        };
      }
    }
  }

  return workingNodes;
}
