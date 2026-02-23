import type { WorkflowNode } from "@/types";
import type { ValidationResult, ValidationContext } from "./types";

/**
 * Validate that GroupNodes are not root nodes
 * GroupNodes require input data, which Start node cannot provide
 */
export function validateRootGroupNodes(
  nodes: WorkflowNode[],
): ValidationResult {
  const rootGroupNodes = nodes.filter(
    (n) => n.type === "group" && !n.parentNode,
  );

  if (rootGroupNodes.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errorType: "INVALID_ROOT_GROUPNODES",
    errorMessage: `Found ${rootGroupNodes.length} GroupNodes without parent (invalid)`,
    affectedNodes: rootGroupNodes,
  };
}

/**
 * Repair invalid root GroupNodes
 *
 * Strategy:
 * - Confirm: Ask AI to insert initialization Task before GroupNode
 * - Cancel: Convert GroupNode to standalone Task
 */
export async function repairRootGroupNodes(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];
  const rootGroupNodes = workingNodes.filter(
    (n) => n.type === "group" && !n.parentNode,
  );

  if (rootGroupNodes.length === 0) {
    return workingNodes;
  }

  // const details = rootGroupNodes
  //   .map((n) => `"${n.data.title ?? "Untitled"}"`)
  //   .join(", ");

  // ════════════════════════════════════════════════════════════
  // DIALOG DISABLED: Auto-confirm for seamless validation UX
  // ════════════════════════════════════════════════════════════
  // const confirmed = await context.dialog.confirm(
  //   "Invalid Root GroupNode Detected",
  //   `${rootGroupNodes.length} GroupNode(s) are direct children of Start: ${details}.\n\nGroupNodes cannot be root nodes because they require input data.\n\nConfirm: Ask AI to insert initialization Task node(s) before the GroupNode(s).\nCancel: Convert GroupNode(s) to standalone Task node(s).`,
  // );
  const confirmed = true; // Always use AI-powered fix

  if (confirmed) {
    // ── AI FIX PATH (ACTIVE) ──────────────────────────────────
    for (const groupNode of rootGroupNodes) {
      const fixPrompt = `The GroupNode "${groupNode.data.title ?? "Untitled"}" (id: ${groupNode.id}) is a direct child of Start, which is invalid. GroupNodes require input data but Start provides none. Insert a Task node before this GroupNode to initialize the required data (e.g., { date, tasks: [] }). The Task node should have no parentNode (root), and the GroupNode should have the Task as its parentNode.`;

      const editResult = await context.updateWorkflowAction(
        groupNode.id,
        fixPrompt,
        workingNodes,
      );

      if (editResult.nodes.create?.length) {
        workingNodes = [...workingNodes, ...editResult.nodes.create];
      }
      editResult.nodes.update?.forEach((update) => {
        const idx = workingNodes.findIndex((n) => n.id === update.id);
        if (idx >= 0) {
          workingNodes[idx] = {
            ...workingNodes[idx],
            data: { ...workingNodes[idx].data, ...update.data },
            parentNode: update.parentNode || workingNodes[idx].parentNode,
          };
        }
      });
    }
  }
  // else {
  //   // ── CANCEL PATH (DISABLED) ─────────────────────────────
  //   // Convert GroupNodes to Task nodes
  //   workingNodes = workingNodes.map((n) => {
  //     if (rootGroupNodes.some((rg) => rg.id === n.id)) {
  //       // Convert GroupNode to Task
  //       // Use helper functions to safely extract node data
  //       return {
  //         ...n,
  //         type: "task" as const,
  //         data: {
  //           title: getNodeTitle(n),
  //           description: getNodeDescription(n),
  //           assignee: "",
  //           estimatedTime: 0,
  //           metadata: {},
  //           execution: n.data.execution,
  //           ports: n.data.ports,
  //         },
  //       };
  //     }
  //     return n;
  //   });
  // }
  // ════════════════════════════════════════════════════════════

  return workingNodes;
}
