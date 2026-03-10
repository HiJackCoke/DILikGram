import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import { detectAsync } from "@/utils/workflow/runtime";
import { getExecutionConfig } from "../utils/validationUtils";

/**
 * Validate that task and decision nodes do not contain async/API code
 *
 * Task nodes must be synchronous. Decision nodes must be synchronous (boolean logic only).
 * Async operations (await, fetch, Promise, .then) should be placed in ServiceNodes instead.
 */
export function validateSyncOnlyNodes(nodes: WorkflowNode[]): ValidationResult {
  const affected = nodes.filter((n) => {
    if (n.type !== "task" && n.type !== "decision") return false;
    const config = getExecutionConfig(n);
    const fc = config?.functionCode;
    return !!fc && detectAsync(fc);
  });

  if (affected.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errorType: "ASYNC_TASK_NODES",
    errorMessage: `Found ${affected.length} node(s) with async/API code. Task and decision nodes must be synchronous — use ServiceNodes for HTTP/async operations.`,
    affectedNodes: affected,
  };
}

/**
 * Repair async task/decision nodes by converting them via AI
 *
 * Strategy:
 * - Task nodes: convert to ServiceNode with extracted http config
 * - Decision nodes: rewrite to synchronous boolean logic only
 */
export async function repairSyncOnlyNodes(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];

  const affected = workingNodes.filter((n) => {
    if (n.type !== "task" && n.type !== "decision") return false;
    const config = getExecutionConfig(n);
    const fc = config?.functionCode;
    return !!fc && detectAsync(fc);
  });

  if (affected.length === 0) {
    return workingNodes;
  }

  for (const node of affected) {
    const config = getExecutionConfig(node);
    const functionCode = config?.functionCode ?? "";
    const title = node.data.title ?? "Untitled";
    const id = node.id;

    let fixPrompt: string;

    if (node.type === "task") {
      fixPrompt = `Node "${title}" (id: ${id}) is a TASK node but has async/API code in its functionCode.

functionCode: ${functionCode}

RULE: Task nodes must be synchronous. This node must be converted to a SERVICE node.
You MUST update this node to:
1. Change type to "service"
2. Add serviceType: "api"
3. Add http config (extract method/endpoint from functionCode)
4. Set execution.config.isAsync = true
5. Keep the same title, description, and functionCode logic

Extract the HTTP method and endpoint from the functionCode and fill in the http config.`;
    } else {
      fixPrompt = `Node "${title}" (id: ${id}) is a DECISION node but has async code in its functionCode.

functionCode: ${functionCode}

RULE: Decision nodes must be synchronous — they only evaluate conditions and return { ...inputData, success: boolean }.
You MUST update functionCode to be synchronous:
1. Remove all await/async/.then()/Promise usage
2. If an API call is needed before this condition, create a separate ServiceNode upstream
3. functionCode should only contain pure boolean logic using inputData fields`;
    }

    const editResult = await context.updateWorkflowAction(
      id,
      fixPrompt,
      workingNodes,
    );

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

  return workingNodes;
}
