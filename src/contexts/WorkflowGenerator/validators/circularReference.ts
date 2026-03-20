import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "../../../types/ai/validators";
import { getGroups, getNodeTitle } from "../utils/typeGuards";

// ─────────────────────────────────────────────────────────────────────────────
// General parentNode cycle detection (A → B → ... → A)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect general parentNode cycles: A → B → ... → A
 * Returns the list of node IDs that are entry points of each cycle.
 */
function detectParentNodeCycleEntries(nodes: WorkflowNode[]): Set<string> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const globalVisited = new Set<string>();
  const cycleEntries = new Set<string>();

  for (const startNode of nodes) {
    if (globalVisited.has(startNode.id)) continue;

    const chainIndexMap = new Map<string, number>();
    const chain: WorkflowNode[] = [];
    let current: WorkflowNode | undefined = startNode;

    while (current) {
      if (globalVisited.has(current.id)) break;

      if (chainIndexMap.has(current.id)) {
        // current.id is the entry point of the cycle
        cycleEntries.add(current.id);
        break;
      }

      chainIndexMap.set(current.id, chain.length);
      chain.push(current);
      current = current.parentNode
        ? nodeMap.get(current.parentNode)
        : undefined;
    }

    chain.forEach((n) => globalVisited.add(n.id));
  }

  return cycleEntries;
}

export function validateParentNodeCycles(
  nodes: WorkflowNode[],
): ValidationResult {
  const cycleEntries = detectParentNodeCycleEntries(nodes);
  if (cycleEntries.size === 0) return { valid: true };

  const affectedNodes = nodes.filter((n) => cycleEntries.has(n.id));
  return {
    valid: false,
    errorType: "CIRCULAR_PARENTNODE_CYCLE",
    errorMessage: `Found ${cycleEntries.size} node(s) forming circular parentNode cycles`,
    affectedNodes,
  };
}

// export function deterministicRepairParentNodeCycles(
//   nodes: WorkflowNode[],
// ): WorkflowNode[] {
//   const cycleEntries = detectParentNodeCycleEntries(nodes);
//   if (cycleEntries.size === 0) return nodes;

//   console.log(
//     "[deterministicRepairParentNodeCycles] Breaking cycles at:",
//     [...cycleEntries],
//   );

//   return nodes.map((n) =>
//     cycleEntries.has(n.id) ? { ...n, parentNode: undefined } : n,
//   );
// }

// export async function repairParentNodeCycles(
//   context: ValidationContext,
// ): Promise<WorkflowNode[]> {
//   const workingNodes = [...context.nodes];
//   const cycleEntries = detectParentNodeCycleEntries(workingNodes);
//   if (cycleEntries.size === 0) return workingNodes;

//   return workingNodes.map((n) => {
//     if (cycleEntries.has(n.id)) {
//       console.log(
//         `[circularReference] Breaking parentNode cycle at node: ${n.id} (was parentNode: ${n.parentNode})`,
//       );
//       return { ...n, parentNode: undefined };
//     }
//     return n;
//   });
// }

/**
 * Information about circular reference in GroupNode
 */
interface CircularGroupInfo {
  groupNode: WorkflowNode;
  parentNodeId: string;
  parentNodeTitle: string;
}

/**
 * Detect circular references in GroupNode parent-child relationships
 *
 * A circular reference occurs when:
 * - GroupNode.parentNode points to a node that is in GroupNode.data.groups[]
 * - This creates an infinite loop: GroupNode → Child → GroupNode → ...
 */
export function validateCircularReferences(
  nodes: WorkflowNode[],
): ValidationResult {
  const circularGroupNodes: CircularGroupInfo[] = [];

  nodes
    .filter((n) => n.type === "group" && n.parentNode)
    .forEach((groupNode) => {
      // Safely get groups array using type guard
      const groups = getGroups(groupNode);
      if (!groups) return; // Skip if not a valid GroupNode

      const internalNodeIds = new Set(groups.map((n) => n.id));

      // Check if GroupNode.parentNode is in groups[]
      if (internalNodeIds.has(groupNode.parentNode!)) {
        const parentNode = nodes.find((n) => n.id === groupNode.parentNode);
        circularGroupNodes.push({
          groupNode,
          parentNodeId: groupNode.parentNode!,
          parentNodeTitle: parentNode ? getNodeTitle(parentNode) : "Untitled",
        });
      }
    });

  if (circularGroupNodes.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errorType: "CIRCULAR_REFERENCE_GROUPNODE",
    errorMessage: `Found ${circularGroupNodes.length} GroupNodes with circular parent-child references`,
    affectedNodes: circularGroupNodes.map((info) => info.groupNode),
    metadata: { circularGroupNodes },
  };
}

/**
 * Repair circular references
 *
 * Strategy:
 * - Confirm: Ask AI to fix by extracting the parent node from groups[]
 * - Cancel: Remove the circular parent reference, make GroupNode root
 */
// export async function repairCircularReferences(
//   context: ValidationContext,
// ): Promise<WorkflowNode[]> {
//   let workingNodes = [...context.nodes];

//   const result = validateCircularReferences(workingNodes);
//   if (result.valid) {
//     return workingNodes;
//   }

//   // Safely extract circularGroupNodes with runtime validation
//   const circularGroupNodes: CircularGroupInfo[] = Array.isArray(
//     result.metadata?.circularGroupNodes,
//   )
//     ? result.metadata.circularGroupNodes
//     : [];

//   // const details = circularGroupNodes
//   //   .map(
//   //     ({ groupNode, parentNodeTitle }) =>
//   //       `"${groupNode.data?.title || "Untitled"}" (parent: "${parentNodeTitle}")`
//   //   )
//   //   .join(", ");

//   // ════════════════════════════════════════════════════════════
//   // DIALOG DISABLED: Auto-confirm for seamless validation UX
//   // ════════════════════════════════════════════════════════════
//   // const confirmed = await context.dialog.confirm(
//   //   "Circular Reference Detected",
//   //   `${circularGroupNodes.length} GroupNode(s) have circular parent-child references: ${details}.\n\n` +
//   //     `This will cause infinite loops.\n\n` +
//   //     `Confirm: Ask AI to fix by extracting the parent node from groups[].\n` +
//   //     `Cancel: Remove the circular parent reference (make GroupNode root).`
//   // );
//   const confirmed = true; // Always use AI-powered fix

//   if (confirmed) {
//     // ── AI FIX PATH (ACTIVE) ──────────────────────────────────
//     for (const {
//       groupNode,
//       parentNodeId,
//       parentNodeTitle,
//     } of circularGroupNodes) {
//       const fixPrompt =
//         `CRITICAL BUG: GroupNode "${groupNode.data?.title || "Untitled"}" (id: ${groupNode.id}) ` +
//         `has a CIRCULAR REFERENCE. ` +
//         `Its parentNode is "${parentNodeTitle}" (id: ${parentNodeId}), ` +
//         `but this node is ALSO inside the GroupNode's groups[] array.\n\n` +
//         `This creates an infinite loop: GroupNode → ${parentNodeTitle} → GroupNode → ...\n\n` +
//         `FIX REQUIRED:\n` +
//         `1. Remove "${parentNodeTitle}" from the GroupNode's groups[] array\n` +
//         `2. Make "${parentNodeTitle}" a standalone node (no parentNode or different parent)\n` +
//         `3. Keep the GroupNode's parentNode pointing to "${parentNodeId}"\n\n` +
//         `The result should be:\n` +
//         `- "${parentNodeTitle}": standalone node (comes BEFORE GroupNode)\n` +
//         `- GroupNode "${groupNode.data?.title}": parentNode = "${parentNodeId}", groups[] does NOT contain "${parentNodeId}"`;

//       const editResult = await context.updateWorkflowAction({
//         targetNodeIds: [groupNode.id],
//         prompt: fixPrompt,
//         nodes: workingNodes,
//       });

//       // Apply updates
//       if (editResult.nodes.update?.length) {
//         editResult.nodes.update.forEach((update) => {
//           const idx = workingNodes.findIndex((n) => n.id === update.id);
//           if (idx >= 0) {
//             workingNodes[idx] = {
//               ...workingNodes[idx],
//               data: { ...workingNodes[idx].data, ...update.data },
//               parentNode: update.parentNode || workingNodes[idx].parentNode,
//             };
//           }
//         });
//       }

//       if (editResult.nodes.create?.length) {
//         workingNodes = [...workingNodes, ...editResult.nodes.create];
//       }

//       if (editResult.nodes.delete?.length) {
//         const deleteIds = new Set(editResult.nodes.delete);
//         workingNodes = workingNodes.filter((n) => !deleteIds.has(n.id));
//       }
//     }
//   }
//   // else {
//   //   // ── CANCEL PATH (DISABLED) ─────────────────────────────
//   //   // Remove circular parent reference
//   //   workingNodes = workingNodes.map((n) => {
//   //     const isCircular = circularGroupNodes.some(
//   //       (info) => info.groupNode.id === n.id
//   //     );
//   //     if (isCircular) {
//   //       return {
//   //         ...n,
//   //         parentNode: undefined,
//   //       };
//   //     }
//   //     return n;
//   //   });
//   // }
//   // ════════════════════════════════════════════════════════════

//   return workingNodes;
// }
