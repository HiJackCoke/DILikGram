import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import { applyAIFixes } from "../utils/validationUtils";

function getChildren(nodes: WorkflowNode[], parentId: string): WorkflowNode[] {
  return nodes.filter((n) => n.parentNode === parentId);
}

/**
 * Validate that all Decision nodes have both "yes" and "no" branches
 *
 * Also checks for orphaned nodes (Decision children missing branchLabel)
 */
export function validateDecisionNodes(nodes: WorkflowNode[]): ValidationResult {
  const incompleteDecisionNodes = nodes
    .filter((n) => n.type === "decision")
    .filter((decisionNode) => {
      const children = getChildren(nodes, decisionNode.id);
      const hasYes = children.some((n) => n.data.branchLabel === "yes");
      const hasNo = children.some((n) => n.data.branchLabel === "no");
      return !hasYes || !hasNo;
    });

  // Orphaned nodes: Decision children with missing/invalid branchLabel
  const allDecisionIds = new Set(
    nodes.filter((n) => n.type === "decision").map((n) => n.id),
  );

  const orphanedNodes = nodes.filter(
    (n) =>
      n.parentNode &&
      allDecisionIds.has(n.parentNode) &&
      (!n.data.branchLabel ||
        (n.data.branchLabel !== "yes" && n.data.branchLabel !== "no")),
  );

  if (incompleteDecisionNodes.length === 0 && orphanedNodes.length === 0) {
    return { valid: true };
  }

  const affectedNodes = [...incompleteDecisionNodes, ...orphanedNodes];

  return {
    valid: false,
    errorType: "INCOMPLETE_DECISION_NODES",
    errorMessage: `Found ${incompleteDecisionNodes.length} incomplete decision nodes and ${orphanedNodes.length} orphaned nodes`,
    affectedNodes,
    metadata: {
      incompleteCount: incompleteDecisionNodes.length,
      orphanedCount: orphanedNodes.length,
    },
  };
}

/**
 * Repair incomplete Decision nodes
 *
 * Strategy:
 * - Confirm: Ask AI to add missing branches
 * - Cancel: Remove Decision nodes and bypass to parent
 */
export async function repairDecisionNodes(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];

  const incompleteDecisionNodes = workingNodes
    .filter((n) => n.type === "decision")
    .filter((decisionNode) => {
      const children = getChildren(workingNodes, decisionNode.id);
      const hasYes = children.some((n) => n.data.branchLabel === "yes");
      const hasNo = children.some((n) => n.data.branchLabel === "no");
      return !hasYes || !hasNo;
    });

  const allDecisionIds = new Set(
    workingNodes.filter((n) => n.type === "decision").map((n) => n.id),
  );

  const orphanedNodes = workingNodes.filter(
    (n) =>
      n.parentNode &&
      allDecisionIds.has(n.parentNode) &&
      (!n.data.branchLabel ||
        (n.data.branchLabel !== "yes" && n.data.branchLabel !== "no")),
  );

  if (incompleteDecisionNodes.length === 0 && orphanedNodes.length === 0) {
    return workingNodes;
  }

  // Build dialog details
  const details = incompleteDecisionNodes
    .map((n) => {
      const children = getChildren(workingNodes, n.id);
      const hasYes = children.some((c) => c.data.branchLabel === "yes");
      return `"${n.data.title}" (missing ${hasYes ? "NO" : "YES"} branch)`;
    })
    .join(", ");

  const confirmed = await context.dialog.confirm(
    "Incomplete Decision Node Detected",
    `${incompleteDecisionNodes.length} Decision node(s) are missing a branch: ${details}.\n\nConfirm: Auto-fix by adding the missing branch.\nCancel: Remove the Decision node(s) and connect their children directly to the parent.`,
  );

  if (confirmed) {
    // ── CONFIRM: AI auto-fix ──────────────────────────────
    for (const decisionNode of incompleteDecisionNodes) {
      const children = getChildren(workingNodes, decisionNode.id);
      const hasYes = children.some((n) => n.data.branchLabel === "yes");
      const hasNo = children.some((n) => n.data.branchLabel === "no");
      const missingBranches = [
        ...(!hasYes ? ["yes"] : []),
        ...(!hasNo ? ["no"] : []),
      ];

      const fixPrompt = `The Decision node "${decisionNode.data.title}" (id: ${decisionNode.id}) is missing the ${missingBranches.join(" and ")} branch(es). Add the missing ${missingBranches.join("/")} branch node(s) with the correct branchLabel.`;

      const editResult = await context.updateWorkflowAction({
        targetNodeIds: [decisionNode.id],
        prompt: fixPrompt,
        nodes: workingNodes,
      });

      workingNodes = applyAIFixes(workingNodes, editResult);
    }

    // ── POST-FIX VALIDATION: Auto-fallback (prevent infinite loops) ──
    const allDecisionIdsAfterFix = new Set(
      workingNodes.filter((n) => n.type === "decision").map((n) => n.id),
    );

    // Check 1: Still incomplete Decision nodes
    const stillIncomplete = workingNodes
      .filter((n) => n.type === "decision")
      .filter((d) => {
        const children = getChildren(workingNodes, d.id);
        return (
          !children.some((n) => n.data.branchLabel === "yes") ||
          !children.some((n) => n.data.branchLabel === "no")
        );
      });

    // Check 2: Orphaned children (Decision parent but missing branchLabel)
    const orphanedDecisionIds = new Set(
      workingNodes
        .filter(
          (n) =>
            n.parentNode &&
            allDecisionIdsAfterFix.has(n.parentNode) &&
            !n.data.branchLabel,
        )
        .map((n) => n.parentNode),
    );

    const problematicIds = new Set([
      ...stillIncomplete.map((n) => n.id),
      ...orphanedDecisionIds,
    ]);

    if (problematicIds.size > 0) {
      // AI fix failed → auto-bypass silently
      workingNodes = workingNodes
        .filter((n) => !problematicIds.has(n.id))
        .map((n) => {
          if (n.parentNode && problematicIds.has(n.parentNode)) {
            const decisionNode = workingNodes.find(
              (d) => d.id === n.parentNode,
            );
            if (!decisionNode) return n;

            // Remove branchLabel from data
            const { branchLabel: _, ...dataWithoutBranchLabel } = n.data;

            return {
              ...n,
              parentNode: decisionNode.parentNode,
              data: dataWithoutBranchLabel,
            };
          }
          return n;
        });
    }
  } else {
    // ── CANCEL: Remove Decision nodes, bypass to parent ─────────
    const incompleteIds = new Set(incompleteDecisionNodes.map((n) => n.id));

    workingNodes = workingNodes
      .filter((n) => !incompleteIds.has(n.id))
      .map((n) => {
        if (n.parentNode && incompleteIds.has(n.parentNode)) {
          const decisionNode = incompleteDecisionNodes.find(
            (d) => d.id === n.parentNode,
          );
          if (!decisionNode) return n;

          // Remove branchLabel from data
          const { branchLabel: _, ...dataWithoutBranchLabel } = n.data;

          return {
            ...n,
            parentNode: decisionNode.parentNode,
            data: dataWithoutBranchLabel,
          };
        }
        return n;
      });
  }

  return workingNodes;
}
