import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import {
  getExecutionConfig,
  extractInputDataReferences,
} from "../utils/validationUtils";

/**
 * Find fields referenced in functionCode but missing from inputData
 *
 * @param referencedFields - Set of fields referenced in code
 * @param inputData - Actual inputData object
 * @returns Array of missing field names
 */
function findMissingFields(
  referencedFields: Set<string>,
  inputData: unknown,
): string[] {
  // If functionCode references fields but inputData is null/undefined
  if (!inputData && referencedFields.size > 0) {
    return Array.from(referencedFields);
  }

  // If no fields referenced or no inputData, nothing is missing
  if (!inputData || referencedFields.size === 0) {
    return [];
  }

  // Find fields referenced in code but not in inputData
  const inputKeys = Object.keys(inputData);
  return Array.from(referencedFields).filter(
    (field) => !inputKeys.includes(field),
  );
}

/**
 * Validate functionCode references match inputData fields
 * Checks Task and Service nodes only
 */
export function validateFunctionCodeInputData(
  nodes: WorkflowNode[],
): ValidationResult {
  const nodesWithMismatch = nodes.filter((n) => {
    if (n.type !== "task" && n.type !== "service") return false;

    const config = getExecutionConfig(n);
    if (!config?.functionCode) return false;

    const referencedFields = extractInputDataReferences(config.functionCode);
    const missingFields = findMissingFields(
      referencedFields,
      config.nodeData?.inputData,
    );

    return missingFields.length > 0;
  });

  if (nodesWithMismatch.length === 0) {
    return { valid: true };
  }

  const details = nodesWithMismatch.map((n) => {
    const config = getExecutionConfig(n);
    const referencedFields = extractInputDataReferences(config?.functionCode ?? "");
    const missingFields = findMissingFields(referencedFields, config?.nodeData?.inputData);
    const availableKeys = config?.nodeData?.inputData
      ? Object.keys(config.nodeData.inputData as object)
      : [];
    return `"${n.data.title ?? n.id}" (${n.id}): functionCode references [${missingFields.join(", ")}] but inputData only has [${availableKeys.join(", ") || "null/none"}]`;
  });

  return {
    valid: false,
    errorType: "FUNCTIONCODE_INPUTDATA_MISMATCH",
    errorMessage: `Found ${nodesWithMismatch.length} nodes with functionCode/inputData mismatch: ${details.join(" | ")}`,
    affectedNodes: nodesWithMismatch,
    metadata: { mismatches: nodesWithMismatch.map((n) => {
      const config = getExecutionConfig(n);
      const referencedFields = extractInputDataReferences(config?.functionCode ?? "");
      const missingFields = findMissingFields(referencedFields, config?.nodeData?.inputData);
      return { nodeId: n.id, missingFields, availableKeys: config?.nodeData?.inputData ? Object.keys(config.nodeData.inputData as object) : [] };
    })},
  };
}

/**
 * Repair functionCode/inputData mismatches
 *
 * Strategy:
 * - Confirm: Ask AI to fix the mismatch (context-aware prompts)
 * - Cancel: Proceed anyway (may cause runtime errors)
 */
export async function repairFunctionCodeMismatch(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];
  const nodesWithMismatch = workingNodes.filter((n) => {
    if (n.type !== "task" && n.type !== "service") return false;

    const config = getExecutionConfig(n);
    if (!config?.functionCode) return false;

    const referencedFields = extractInputDataReferences(config.functionCode);
    const missingFields = findMissingFields(
      referencedFields,
      config.nodeData?.inputData,
    );

    return missingFields.length > 0;
  });

  if (nodesWithMismatch.length === 0) {
    return workingNodes;
  }

  // Build dialog details
  // const details = nodesWithMismatch
  //   .map((n) => {
  //     const config = getExecutionConfig(n);
  //     if (!config?.functionCode) return "";

  //     const referencedFields = extractInputDataReferences(config.functionCode);
  //     const inputData = config.nodeData?.inputData;

  //     if (!inputData) {
  //       return `"${n.data.title ?? "Untitled"}" (functionCode uses ${Array.from(referencedFields).join(", ")} but inputData is MISSING)`;
  //     }

  //     // After null check, inputData is guaranteed to be Record<string, unknown>
  //     const missingFields = findMissingFields(referencedFields, inputData);
  //     const inputKeys = Object.keys(inputData);

  //     return `"${n.data.title ?? "Untitled"}" (functionCode uses ${missingFields.join(", ")} but inputData only has ${inputKeys.join(", ")})`;
  //   })
  //   .join(", ");

  // ════════════════════════════════════════════════════════════
  // DIALOG DISABLED: Auto-confirm for seamless validation UX
  // ════════════════════════════════════════════════════════════
  // const confirmed = await context.dialog.confirm(
  //   "functionCode ↔ inputData Mismatch Detected",
  //   `${nodesWithMismatch.length} node(s) have functionCode that references fields not in inputData: ${details}.\n\nConfirm: Ask AI to fix the mismatch.\nCancel: Proceed anyway (may cause runtime errors).`,
  // );
  const confirmed = true; // Always use AI-powered fix

  if (confirmed) {
    // ── AI FIX PATH (ACTIVE) ──────────────────────────────────
    for (const node of nodesWithMismatch) {
      const config = getExecutionConfig(node);
      if (!config?.functionCode) continue;

      const functionCode = config.functionCode;
      const inputData = config.nodeData?.inputData;

      const referencedFields = extractInputDataReferences(functionCode);

      let fixPrompt = "";

      // Check if node is inside a GroupNode
      const parentNode = workingNodes.find((n) => n.id === node.parentNode);
      if (parentNode?.type === "group") {
        const groupInputData = getExecutionConfig(parentNode)?.nodeData?.inputData;
        if (!inputData) {
          if (!groupInputData) {
            // GroupNode itself has null inputData → boundary sync will wipe any inputData we add.
            // The correct fix: REWRITE functionCode to not reference inputData at all.
            fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is inside a GroupNode, but both the node AND the GroupNode have inputData=null.

functionCode: ${functionCode} (INCORRECT — references inputData fields: ${Array.from(referencedFields).join(", ")})

SITUATION: The GroupNode.inputData is null, so boundary sync will ALWAYS set this node's inputData to null.
Adding fields to inputData is FUTILE — they get wiped every repair cycle.

RULE: REWRITE functionCode to NOT reference inputData at all.
Instead, simulate the operation with hardcoded or context-derived data (no inputData reads).

EXAMPLES:
- "Delete Macro" → return { success: true, deletedMacroId: "macro-001", message: "Macro deleted" };
- "Remove Item" → return { success: true, itemId: "item-001" };
- "Clear Selection" → return { cleared: true };

DO NOT add inputData. DO NOT reference inputData.anything. Return a hardcoded result that makes semantic sense.`;
          } else {
            // GroupNode child missing inputData but GroupNode has inputData
            fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is inside a GroupNode but is MISSING execution.config.nodeData.inputData.

GroupNode.inputData: ${JSON.stringify(groupInputData)} (THIS IS THE AUTHORITATIVE SOURCE — match exactly)
functionCode: ${functionCode} (references inputData fields)

RULE: Set execution.config.nodeData.inputData to EXACTLY MATCH GroupNode.inputData (same keys + representative values).
Then update functionCode to ONLY use those GroupNode.inputData keys.

CRITICAL: Match the VALUE TYPE and STRUCTURE from GroupNode.inputData.
DO NOT add keys that are NOT in GroupNode.inputData — they get wiped by boundary sync.

This inputData should match what the GroupNode receives from its parent.`;
          }
        } else {
          // GroupNode child has inputData but functionCode references wrong fields
          // After !inputData check above, inputData is guaranteed to be Record<string, unknown>
          const missingFields = findMissingFields(referencedFields, inputData);

          fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is inside a GroupNode and has a mismatch:

inputData: ${JSON.stringify(inputData)} (THIS IS CORRECT - from previous node)
functionCode: ${functionCode} (THIS IS INCORRECT - uses fields: ${Array.from(referencedFields).join(", ")})
Missing fields: ${missingFields.join(", ")}

RULE: You MUST update functionCode to ONLY use fields that exist in inputData: ${Object.keys(inputData).join(", ")}.
DO NOT change inputData - it is already correct.`;
        }
      }
      // Root node (no parent)
      else if (!node.parentNode) {
        fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is a root node (direct child of Start) but functionCode references inputData fields.

functionCode: ${functionCode} (INCORRECT - references inputData)

RULE: Root nodes receive inputData: null. You MUST update functionCode to NOT reference any inputData fields.
Initialize data from scratch instead.`;
      }
      // Regular node
      else {
        if (!inputData) {
          // Regular node missing inputData
          fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is missing execution.config.nodeData.inputData but functionCode references inputData fields.

functionCode: ${functionCode}

RULE: Add execution.config.nodeData.inputData with all fields that functionCode references.

Analyze how functionCode uses each field:
- If functionCode uses field.property → field must have that property
- If functionCode uses array.filter/map/etc → field must be an array with proper structure
- Example: "inputData.tasks.filter(t => t.completed)" → { tasks: [{ completed: false }] }

CRITICAL: Match the VALUE TYPE and STRUCTURE that functionCode expects.
DO NOT use [null] or empty arrays if functionCode expects specific properties.`;
        } else {
          // Regular node has inputData but mismatch
          fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) has a mismatch.

inputData: ${JSON.stringify(inputData)}
functionCode: ${functionCode}

RULE: Update functionCode to ONLY use fields in inputData, OR update inputData to include missing fields.`;
        }
      }

      const editResult = await context.updateWorkflowAction({
        targetNodeIds: [node.id],
        prompt: fixPrompt,
        nodes: workingNodes,
      });

      // Apply updates
      if (editResult.nodes.update?.length) {
        editResult.nodes.update.forEach((update) => {
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

      // Apply creations
      if (editResult.nodes.create?.length) {
        workingNodes = [...workingNodes, ...editResult.nodes.create];
      }

      // Apply deletions
      if (editResult.nodes.delete?.length) {
        const deleteIds = new Set(editResult.nodes.delete);
        workingNodes = workingNodes.filter((n) => !deleteIds.has(n.id));
      }
    }
  }
  // NOTE: No else block - if user cancels (not applicable now),
  // simply return workingNodes unchanged
  // ════════════════════════════════════════════════════════════

  return workingNodes;
}
