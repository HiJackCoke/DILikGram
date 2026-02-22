import type { ExecutionConfig, WorkflowNode } from "@/types";
import { isExecutionConfig } from "./typeGuards";

// ============================================
// EXECUTION CONFIG UTILITIES (from dataFlowUtils.ts)
// ============================================

/**
 * Safely extract execution config from a node
 * Returns the config object or null if not present
 *
 * Uses runtime type checking to ensure type safety without assertions
 */
export function getExecutionConfig(node: WorkflowNode): ExecutionConfig | null {
  const config = node.data?.execution?.config;

  if (!config) return null;

  // Validate structure matches ExecutionConfig
  if (!isExecutionConfig(config)) return null;

  return config;
}

// ============================================
// FUNCTION CODE PARSING UTILITIES (from functionCodeParser.ts)
// ============================================

/**
 * Extract all inputData field references from functionCode
 * Finds patterns like: inputData.fieldName
 *
 * @param functionCode - JavaScript function code as string
 * @returns Set of referenced field names
 */
export function extractInputDataReferences(functionCode: string): Set<string> {
  const regex = /inputData\.(\w+)/g;
  const referencedFields = new Set<string>();
  let match;

  while ((match = regex.exec(functionCode)) !== null) {
    referencedFields.add(match[1]);
  }

  return referencedFields;
}

// ============================================
// GROUPNODE UTILITIES (NEW)
// ============================================

/**
 * Rebuild GroupNode.data.groups from flat node list
 *
 * After validation/AI modifications, GroupNode.data.groups can become stale.
 * This function rebuilds it from the flat node list using parentNode references.
 *
 * @param nodes - Flat list of all workflow nodes
 * @returns Updated nodes with corrected GroupNode.data.groups
 *
 * @example
 * workingNodes = rebuildGroupChildren(workingNodes);
 */
export function rebuildGroupChildren(nodes: WorkflowNode[]): WorkflowNode[] {
  const groupChildren = buildParentChildMap(nodes);

  return nodes.map((node) => {
    if (node.type !== "group") return node;

    const children = groupChildren[node.id] ?? [];

    return {
      ...node,
      data: {
        ...node.data,
        groups: children
          .filter((child) => child.type !== "decision") // Decision nodes execute at workflow level
          .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)) // Top-to-bottom
          .map(({ parentNode: _p, ...rest }) => rest), // Remove parentNode to avoid circular refs
      },
    };
  });
}

/**
 * Build parent-child map from flat node list
 *
 * @param nodes - Flat list of nodes
 * @returns Map of parent ID to child nodes
 *
 * @example
 * const childrenMap = buildParentChildMap(nodes);
 * const groupChildren = childrenMap["group-node-id"] ?? [];
 */
export function buildParentChildMap(
  nodes: WorkflowNode[],
): Record<string, WorkflowNode[]> {
  const map: Record<string, WorkflowNode[]> = {};

  nodes.forEach((node) => {
    if (node.parentNode) {
      if (!map[node.parentNode]) {
        map[node.parentNode] = [];
      }
      map[node.parentNode].push(node);
    }
  });

  return map;
}

/**
 * Remove duplicate nodes by ID, keeping last occurrence
 *
 * When AI fixes are applied, updated nodes should override originals.
 * Map keeps the last value when duplicate keys are inserted.
 *
 * @param nodes - Array of nodes (may contain duplicates)
 * @returns Deduplicated array
 *
 * @example
 * workingNodes = deduplicateNodesById(workingNodes);
 */
export function deduplicateNodesById(nodes: WorkflowNode[]): WorkflowNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
