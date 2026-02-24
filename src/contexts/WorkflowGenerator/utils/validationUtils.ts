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

// export function rebuildGroupChildren(nodes: WorkflowNode[]): WorkflowNode[] {
//   const groupChildren = buildParentChildMap(nodes);

//   const result: WorkflowNode[] = [];

//   for (const node of nodes) {
//     if (node.type !== "group") {
//       result.push(node);
//       continue;
//     }

//     const children = groupChildren[node.id] || [];

//     result.push({
//       ...node,
//       data: {
//         ...node.data,
//         groups: children
//           .filter((child) => child.type !== "decision")
//           .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
//           .map(({ parentNode: _p, ...rest }) => rest),
//       },
//     });
//   }

//   return result;
// }

// export function rebuildGroupChildren(nodes: WorkflowNode[]): WorkflowNode[] {
//   const groupChildren = buildParentChildMap(nodes);

//   // function 키워드를 사용하고, 첫 번째 인자로 this의 타입을 명시합니다.
//   return nodes.map(function (this: Record<string, WorkflowNode[]>, node) {
//     if (node.type !== "group") return node;

//     // 이제 이 안에서 this는 Record<string, WorkflowNode[]> 타입으로 안전하게 추론됩니다.
//     const children = this[node.id] ?? [];

//     return {
//       ...node,
//       data: {
//         ...node.data,
//         groups: children
//           .filter((child) => child.type !== "decision")
//           .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
//           .map(({ parentNode: _p, ...rest }) => rest),
//       },
//     };
//   }, groupChildren); // 실제 groupChildren이 this로 주입됨
// }

// 1. 노드 하나를 변환하는 로직을 완전히 분리 (Minifier가 접근 못 함)
const transformNode = (
  node: WorkflowNode,
  lookup: Record<string, WorkflowNode[]>,
) => {
  if (node.type !== "group") return node;
  const children = lookup[node.id] ?? [];

  return {
    ...node,
    data: {
      ...node.data,
      groups: children
        .filter((child) => child.type !== "decision")
        .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
        .map(({ parentNode: _p, ...rest }) => rest),
    },
  };
};

export function rebuildGroupChildren(nodes: WorkflowNode[]): WorkflowNode[] {
  const groupChildren = buildParentChildMap(nodes);

  // 2. lookup이라는 명시적 인자로 넘기기 (this 타입 고민 없음)
  return nodes.map((node) => transformNode(node, groupChildren));
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
