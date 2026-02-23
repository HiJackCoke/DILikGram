import type { WorkflowNode } from "@/types";
import type { ValidationResult, ValidationContext } from "./types";
import { getExecutionConfig, extractInputDataReferences } from "../utils/validationUtils";

/**
 * Validate that children of start nodes have null inputData
 *
 * RULE: Start nodes produce no output, so their children must have:
 * - execution.config.nodeData.inputData: null (or undefined)
 * - functionCode that doesn't reference inputData fields
 */
export function validateStartNodeChildren(
  nodes: WorkflowNode[]
): ValidationResult {
  const invalidNodes = nodes.filter((node) => {
    // Skip start/end nodes
    if (node.type === "start" || node.type === "end") return false;

    // Find parent node
    if (!node.parentNode) return false;
    const parent = nodes.find((n) => n.id === node.parentNode);

    // Check if parent is a start node
    if (parent?.type !== "start") return false;

    // Get execution config
    const config = getExecutionConfig(node);
    if (!config) return false; // No execution config is OK

    // Check 1: inputData should be null or undefined
    const hasNonNullInputData =
      config.nodeData?.inputData !== null &&
      config.nodeData?.inputData !== undefined;

    // Check 2: functionCode shouldn't reference inputData
    const referencesInputData =
      config.functionCode &&
      extractInputDataReferences(config.functionCode).size > 0;

    return hasNonNullInputData || referencesInputData;
  });

  if (invalidNodes.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errorType: "START_NODE_CHILD_INVALID_INPUT",
    errorMessage: `Found ${invalidNodes.length} node(s) with start node parent but non-null inputData`,
    affectedNodes: invalidNodes,
    metadata: {
      rule: "Nodes with start node as parent must have inputData: null",
    },
  };
}

/**
 * Repair start node child inputData issues
 *
 * Strategy:
 * 1. If functionCode doesn't reference inputData: auto-fix (set inputData to null)
 * 2. If functionCode references inputData: ask AI to rewrite without inputData
 */
export async function repairStartNodeChildren(
  context: ValidationContext
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];

  // Find all invalid nodes
  const invalidNodes = workingNodes.filter((node) => {
    if (node.type === "start" || node.type === "end") return false;
    if (!node.parentNode) return false;

    const parent = workingNodes.find((n) => n.id === node.parentNode);
    if (parent?.type !== "start") return false;

    const config = getExecutionConfig(node);
    if (!config) return false;

    const hasNonNullInputData =
      config.nodeData?.inputData !== null &&
      config.nodeData?.inputData !== undefined;

    const referencesInputData =
      config.functionCode &&
      extractInputDataReferences(config.functionCode).size > 0;

    return hasNonNullInputData || referencesInputData;
  });

  if (invalidNodes.length === 0) {
    return workingNodes;
  }

  // Categorize nodes: auto-fixable vs needs AI repair
  const autoFixable: WorkflowNode[] = [];
  const needsAIRepair: WorkflowNode[] = [];

  invalidNodes.forEach((node) => {
    const config = getExecutionConfig(node);
    const referencesInputData =
      config?.functionCode &&
      extractInputDataReferences(config.functionCode).size > 0;

    if (referencesInputData) {
      needsAIRepair.push(node);
    } else {
      autoFixable.push(node);
    }
  });

  // Auto-fix nodes that don't reference inputData
  autoFixable.forEach((node) => {
    const idx = workingNodes.findIndex((n) => n.id === node.id);
    if (idx >= 0) {
      const config = getExecutionConfig(node);
      if (config && config.functionCode) {
        workingNodes[idx] = {
          ...workingNodes[idx],
          data: {
            ...workingNodes[idx].data,
            execution: {
              ...workingNodes[idx].data.execution,
              config: {
                functionCode: config.functionCode,
                lastModified: Date.now(),
                nodeData: {
                  ...config.nodeData,
                  inputData: null,
                },
              },
            },
          },
        };
      }
    }
  });

  // AI repair for nodes with functionCode referencing inputData
  if (needsAIRepair.length > 0) {
    const details = needsAIRepair
      .map((n) => {
        const config = getExecutionConfig(n);
        const referencedFields = config?.functionCode
          ? Array.from(extractInputDataReferences(config.functionCode))
          : [];
        return `"${n.data.title ?? "Untitled"}" (references ${referencedFields.join(", ")})`;
      })
      .join(", ");

    // ════════════════════════════════════════════════════════════
    // DIALOG DISABLED: Auto-confirm for seamless validation UX
    // ════════════════════════════════════════════════════════════
    // const confirmed = await context.dialog.confirm(
    //   "Start Node Child Validation Error",
    //   `${needsAIRepair.length} node(s) have a start node as parent but reference inputData in functionCode: ${details}.\n\n` +
    //     `RULE: Start nodes produce no output, so their children receive inputData: null.\n\n` +
    //     `Confirm: Ask AI to rewrite functionCode without inputData references.\n` +
    //     `Cancel: Proceed anyway (will cause runtime errors).`
    // );
    const confirmed = true; // Always use AI-powered fix

    if (confirmed) {
      for (const node of needsAIRepair) {
        const config = getExecutionConfig(node);
        if (!config?.functionCode) continue;

        const referencedFields = Array.from(
          extractInputDataReferences(config.functionCode)
        );

        const fixPrompt = `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) has a START NODE as its parent but functionCode references inputData.

functionCode: ${config.functionCode}
Referenced fields: ${referencedFields.join(", ")}

CRITICAL RULE: Start nodes produce NO OUTPUT. Nodes with start node as parent receive inputData: null.

You MUST rewrite functionCode to:
1. NOT reference any inputData fields
2. Initialize all data from scratch (constants, empty objects, etc.)
3. Maintain the same business logic but without inputData dependency

Examples:
- WRONG: return inputData.tasks.filter(t => !t.completed);
- RIGHT: return []; // or initialize with default data

- WRONG: const date = new Date(inputData.date);
- RIGHT: const date = new Date(); // use current date

Also update execution.config.nodeData.inputData to null.`;

        const editResult = await context.updateWorkflowAction(
          node.id,
          fixPrompt,
          workingNodes
        );

        // Apply AI updates
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

        if (editResult.nodes.create?.length) {
          workingNodes = [...workingNodes, ...editResult.nodes.create];
        }

        if (editResult.nodes.delete?.length) {
          const deleteIds = new Set(editResult.nodes.delete);
          workingNodes = workingNodes.filter((n) => !deleteIds.has(n.id));
        }
      }
    }
    // NOTE: No else block - if user cancels (not applicable now),
    // simply proceed with auto-fixed nodes from earlier step
    // ════════════════════════════════════════════════════════════
  }

  return workingNodes;
}
