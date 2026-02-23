import type { WorkflowNode } from "@/types";
import type { ValidationResult, ValidationContext } from "./types";

import { getExecutionConfig } from "../utils/validationUtils";

/**
 * Information about a broken GroupNode pipeline
 */
interface BrokenGroupInfo {
  groupNode: WorkflowNode;
  breakIndex: number;
  prevTitle: string;
  nextTitle: string;
}

/**
 * Check if two nodes have data flow overlap
 * Returns true if prev.outputData overlaps with next.inputData
 *
 * @param prevNode - Previous node in the pipeline
 * @param nextNode - Next node in the pipeline
 * @returns true if data can flow from prev to next
 */
function hasDataFlowOverlap(
  prevNode: WorkflowNode,
  nextNode: WorkflowNode,
): boolean {
  const prevConfig = getExecutionConfig(prevNode);
  const nextConfig = getExecutionConfig(nextNode);

  const outputData = prevConfig?.nodeData?.outputData;
  const inputData = nextConfig?.nodeData?.inputData;

  // If prev produces no output, consider valid (nothing to check)
  if (!outputData || Object.keys(outputData).length === 0) {
    return true;
  }

  // If next expects no input, no overlap possible
  if (!inputData || inputData === null) {
    return false;
  }

  // Check for at least one overlapping key
  const outputKeys = new Set(Object.keys(outputData));
  const inputKeys = Object.keys(inputData);

  return inputKeys.some((key) => outputKeys.has(key));
}

function createGroupParentMap(
  nodes: WorkflowNode[],
): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  nodes
    .filter((n) => n.type === "group")
    .forEach((n) => {
      map[n.id] = n.parentNode;
    });
  return map;
}

function reparentNodes(
  nodes: WorkflowNode[],
  nodeIds: Set<string>,
  newParentMap: Record<string, string | undefined>,
): WorkflowNode[] {
  return nodes.map((n) => {
    if (nodeIds.has(n.id) && n.parentNode) {
      const newParent = newParentMap[n.parentNode];
      if (newParent !== undefined) {
        return { ...n, parentNode: newParent };
      }
    }
    return n;
  });
}

function sortNodesByPosition(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));
}

function getNonDecisionChildren(
  nodes: WorkflowNode[],
  parentId: string,
): WorkflowNode[] {
  return nodes.filter(
    (n) => n.parentNode === parentId && n.type !== "decision",
  );
}

/**
 * Detect broken GroupNode pipelines
 * A pipeline is broken when prev.outputData doesn't overlap with next.inputData
 */
function detectBrokenGroups(nodes: WorkflowNode[]): BrokenGroupInfo[] {
  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );
  const groupChildrenSorted: Record<string, WorkflowNode[]> = {};

  // Collect and sort children for each GroupNode
  nodes.forEach((n) => {
    if (
      n.parentNode &&
      groupNodeIds.has(n.parentNode) &&
      n.type !== "decision"
    ) {
      if (!groupChildrenSorted[n.parentNode]) {
        groupChildrenSorted[n.parentNode] = [];
      }
      groupChildrenSorted[n.parentNode].push(n);
    }
  });

  Object.values(groupChildrenSorted).forEach((arr) =>
    arr.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)),
  );

  const broken: BrokenGroupInfo[] = [];

  Object.entries(groupChildrenSorted).forEach(([groupId, children]) => {
    for (let i = 0; i < children.length - 1; i++) {
      const prevNode = children[i];
      const nextNode = children[i + 1];

      if (!hasDataFlowOverlap(prevNode, nextNode)) {
        const groupNode = nodes.find((n) => n.id === groupId);
        if (!groupNode) continue;

        broken.push({
          groupNode,
          breakIndex: i,
          prevTitle: prevNode.data.title ?? "Untitled",
          nextTitle: nextNode.data.title ?? "Untitled",
        });
        break; // Only report first break per group
      }
    }
  });

  return broken;
}

/**
 * Validate GroupNode internal pipelines
 * Checks that data flows correctly between sequential nodes
 */
export function validateGroupNodePipelines(
  nodes: WorkflowNode[],
): ValidationResult {
  const brokenGroups = detectBrokenGroups(nodes);

  if (brokenGroups.length === 0) {
    return { valid: true };
  }

  const affectedNodes = nodes.filter((n) =>
    brokenGroups.some((g) => g.groupNode.id === n.id),
  );

  return {
    valid: false,
    errorType: "BROKEN_GROUPNODE_PIPELINES",
    errorMessage: `Found ${brokenGroups.length} GroupNodes with broken data pipelines`,
    affectedNodes,
    metadata: { brokenGroups },
  };
}

/**
 * Repair broken GroupNode pipelines
 *
 * Strategy:
 * - Confirm: Ask AI to fix data chain
 * - Cancel: Split disconnected nodes out of GroupNode
 */
export async function repairGroupNodePipelines(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];
  const brokenGroups = detectBrokenGroups(workingNodes);

  if (brokenGroups.length === 0) {
    return workingNodes;
  }

  const details = brokenGroups
    .map(
      ({ groupNode, prevTitle, nextTitle }) =>
        `"${groupNode.data.title ?? "Untitled"}" (${prevTitle} → ${nextTitle})`,
    )
    .join(", ");

  // ════════════════════════════════════════════════════════════
  // DIALOG DISABLED: Auto-confirm for seamless validation UX
  // ════════════════════════════════════════════════════════════
  // const confirmed = await context.dialog.confirm(
  //   "GroupNode Pipeline Disconnection Detected",
  //   `${brokenGroups.length} GroupNode(s) have a broken internal pipeline: ${details}.\n\nConfirm: Ask AI to repair the data chain.\nCancel: Split the disconnected nodes out of the GroupNode.`,
  // );
  const confirmed = true; // Always use AI-powered fix

  if (confirmed) {
    // ── AI FIX PATH (ACTIVE) ──────────────────────────────────
    for (const { groupNode, breakIndex } of brokenGroups) {
      const children = sortNodesByPosition(
        getNonDecisionChildren(workingNodes, groupNode.id),
      );
      const prevNode = children[breakIndex];
      const nextNode = children[breakIndex + 1];

      const prevConfig = getExecutionConfig(prevNode);
      const nextConfig = getExecutionConfig(nextNode);

      const prevOutput = prevConfig?.nodeData?.outputData;
      const nextInput = nextConfig?.nodeData?.inputData;

      const fixPrompt = `The GroupNode "${groupNode.data.title ?? "Untitled"}" (id: ${groupNode.id}) has a broken pipeline between "${prevNode.data.title ?? "Untitled"}" and "${nextNode.data.title ?? "Untitled"}". The first node outputs ${JSON.stringify(prevOutput)} but the next node expects ${JSON.stringify(nextInput)}. Fix the data chain by adjusting outputData/inputData/functionCode so data flows correctly from one node to the next.`;

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
          };
        }
      });
    }

    // ── POST-FIX VALIDATION: Still broken? → Auto-split silently ──
    const stillBroken = detectBrokenGroups(workingNodes);
    if (stillBroken.length > 0) {
      const ejectIds = new Set<string>();
      stillBroken.forEach(({ groupNode, breakIndex }) => {
        const children = sortNodesByPosition(
          getNonDecisionChildren(workingNodes, groupNode.id),
        );
        for (let j = breakIndex + 1; j < children.length; j++) {
          ejectIds.add(children[j].id);
        }
      });

      const groupParentMapFix = createGroupParentMap(workingNodes);
      workingNodes = reparentNodes(workingNodes, ejectIds, groupParentMapFix);
    }
  }
  // else {
  //   // ── CANCEL PATH (DISABLED) ─────────────────────────────
  //   // Split disconnected nodes out of GroupNode
  //   const ejectIds = new Set<string>();
  //   brokenGroups.forEach(({ groupNode, breakIndex }) => {
  //     const children = sortNodesByPosition(
  //       getNonDecisionChildren(workingNodes, groupNode.id),
  //     );
  //     for (let j = breakIndex + 1; j < children.length; j++) {
  //       ejectIds.add(children[j].id);
  //     }
  //   });
  //
  //   const groupParentMap = createGroupParentMap(workingNodes);
  //   workingNodes = reparentNodes(workingNodes, ejectIds, groupParentMap);
  //
  //   // Dissolve GroupNodes that now have < 2 non-Decision children
  //   const updatedGroupChildren: Record<string, WorkflowNode[]> = {};
  //   workingNodes.forEach((n) => {
  //     if (n.parentNode) {
  //       if (!updatedGroupChildren[n.parentNode]) {
  //         updatedGroupChildren[n.parentNode] = [];
  //       }
  //       updatedGroupChildren[n.parentNode].push(n);
  //     }
  //   });
  //
  //   const nowInvalid = new Set(
  //     workingNodes
  //       .filter((n) => {
  //         if (n.type !== "group") return false;
  //         return (
  //           (updatedGroupChildren[n.id] ?? []).filter(
  //             (c) => c.type !== "decision",
  //           ).length < 2
  //         );
  //       })
  //       .map((n) => n.id),
  //   );
  //
  //   if (nowInvalid.size > 0) {
  //     const invalidParentMap: Record<string, string | undefined> = {};
  //     workingNodes
  //       .filter((n) => nowInvalid.has(n.id))
  //       .forEach((n) => {
  //         invalidParentMap[n.id] = n.parentNode;
  //       });
  //
  //     workingNodes = workingNodes
  //       .filter((n) => !nowInvalid.has(n.id))
  //       .map((n) => {
  //         if (n.parentNode && nowInvalid.has(n.parentNode)) {
  //           return {
  //             ...n,
  //             parentNode: invalidParentMap[n.parentNode],
  //           };
  //         }
  //         return n;
  //       });
  //   }
  // }
  // ════════════════════════════════════════════════════════════

  return workingNodes;
}
