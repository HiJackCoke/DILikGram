import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
} from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";
import { hasDataFlowOverlap } from "./groupNodePipeline";

interface BrokenDataFlowInfo {
  parent: WorkflowNode;
  child: WorkflowNode;
}

/**
 * Detect parent-child pairs where data flow is broken.
 *
 * Excluded from check:
 * - Root nodes (no parentNode)
 * - start/end nodes
 * - Children of start nodes (inputData=null is expected — handled by startNodeChild validator)
 * - Children of group nodes (handled by groupNodePipeline validator)
 * - Nodes with null/undefined inputData (no expected input to validate against)
 */
function detectBrokenParentChildFlows(
  nodes: WorkflowNode[],
): BrokenDataFlowInfo[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const groupNodeIds = new Set(
    nodes.filter((n) => n.type === "group").map((n) => n.id),
  );
  const broken: BrokenDataFlowInfo[] = [];

  for (const child of nodes) {
    // Skip root nodes
    if (!child.parentNode) continue;

    // Skip start/end nodes
    if (child.type === "start" || child.type === "end") continue;

    const parent = nodeMap.get(child.parentNode);
    if (!parent) continue;

    // Skip if parent is start (handled by startNodeChild validator)
    if (parent.type === "start") continue;

    // Skip if parent is group (handled by groupNodePipeline validator)
    if (parent.type === "group") continue;

    // Skip if parent is decision — executor passes decision.inputData (not outputData) to children.
    // Decision outputData = true (boolean), which is NOT comparable against child.inputData keys.
    if (parent.type === "decision") continue;

    // Skip nodes whose parentNode is a group node (they live inside the group)
    if (groupNodeIds.has(child.parentNode)) continue;

    const parentConfig = getExecutionConfig(parent);
    const childConfig = getExecutionConfig(child);
    if (!childConfig) continue;

    const parentOutputData = parentConfig?.nodeData?.outputData;
    const inputData = childConfig.nodeData?.inputData;

    // parent has no output (null/undefined) → child null inputData is expected → skip
    if (parentOutputData === null || parentOutputData === undefined) continue;

    // parent has output (including {}) → child null inputData is a type mismatch → violation
    if (inputData === null || inputData === undefined) {
      broken.push({ parent, child });
      continue;
    }

    // both non-null: check key overlap
    if (!hasDataFlowOverlap(parent, child)) {
      broken.push({ parent, child });
    }
  }

  return broken;
}

/**
 * Validate data flow between general parent-child node pairs.
 *
 * Checks that parent.outputData keyset overlaps with child.inputData keyset.
 * Complements groupNodePipeline (which checks within groups) and
 * startNodeChild (which checks start→child rules).
 */
export function validateParentChildDataFlow(
  nodes: WorkflowNode[],
): ValidationResult {
  const broken = detectBrokenParentChildFlows(nodes);

  if (broken.length === 0) {
    return { valid: true };
  }

  // Collect unique affected nodes (both parent and child sides)
  const seen = new Set<string>();
  const affectedNodes: WorkflowNode[] = [];
  for (const { parent, child } of broken) {
    if (!seen.has(parent.id)) {
      seen.add(parent.id);
      affectedNodes.push(parent);
    }
    if (!seen.has(child.id)) {
      seen.add(child.id);
      affectedNodes.push(child);
    }
  }

  return {
    valid: false,
    errorType: "PARENT_CHILD_DATA_FLOW",
    errorMessage: broken
      .map(({ parent, child }) => {
        const pOut = getExecutionConfig(parent)?.nodeData?.outputData;
        const cIn = getExecutionConfig(child)?.nodeData?.inputData;
        const reason =
          cIn === null || cIn === undefined
            ? `child.inputData is null but parent outputs ${JSON.stringify(pOut ? Object.keys(pOut) : pOut)} — set child.inputData = ${JSON.stringify(pOut)}`
            : `output keys ${JSON.stringify(pOut ? Object.keys(pOut) : null)} ↔ input keys ${JSON.stringify(Object.keys(cIn))} mismatch`;
        // If parent IS a root task (no parentNode), reparenting would make child a root node — wrong.
        // In this case the fix is to update child.inputData to match parent.outputData.
        // Only suggest reparenting if the parent itself has a parent (i.e., parent is not root).
        const parentIsRoot = !parent.parentNode;
        const siblingHint = child.type === "group"
          ? parentIsRoot
            ? ` [FIX HINT: "${child.data.title}" is a feature of this page. Update its inputData to EXACTLY match parent "${parent.data.title}".outputData keys: ${JSON.stringify(pOut ? Object.keys(pOut) : null)}. Do NOT reparent — it is correctly positioned as a child of the root task.]`
            : ` [REPARENTING HINT: "${child.data.title}" is a GroupNode — if it's an independent feature, move it to be a SIBLING of "${parent.data.title}" by setting its parentNode to "${parent.parentNode ?? "null (root)"}"]`
          : "";
        return `"${parent.data.title}"[type=${parent.type}](${parent.id},parentNode=${parent.parentNode ?? "null"}) → "${child.data.title}"[type=${child.type}](${child.id}): ${reason}${siblingHint}`;
      })
      .join(" | "),
    affectedNodes,
    metadata: {
      brokenFlows: broken.map(({ parent, child }) => ({
        parentId: parent.id,
        parentTitle: parent.data.title,
        childId: child.id,
        childTitle: child.data.title,
      })),
    },
  };
}

