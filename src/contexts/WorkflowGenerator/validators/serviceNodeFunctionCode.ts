import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import type { ServiceNodeData } from "@/types/nodes";
import { getExecutionConfig } from "../utils/validationUtils";
import { generatePanelCode } from "@/utils/workflow/codeGenerators";

function isIncomplete(node: WorkflowNode): boolean {
  if (node.type !== "service") return false;
  const config = getExecutionConfig(node);
  console.log(
    config?.functionCode?.trim(),
    "-----------test",
    !config?.functionCode?.trim() ||
      config?.nodeData?.inputData === undefined ||
      config?.nodeData?.outputData === undefined,
  );
  return (
    !config?.functionCode?.trim() ||
    config?.nodeData?.inputData === undefined ||
    config?.nodeData?.outputData === undefined
  );
}

/**
 * Validate that all service nodes have non-empty functionCode, inputData, and outputData
 */
export function validateServiceNodeFunctionCode(
  nodes: WorkflowNode[],
): ValidationResult {
  const affected = nodes.filter(isIncomplete);

  if (affected.length === 0) return { valid: true };

  return {
    valid: false,
    errorType: "SERVICE_NODE_FUNCTION_CODE_MISSING",
    errorMessage: `Found ${affected.length} service node(s) with missing functionCode, inputData, or outputData`,
    affectedNodes: affected,
  };
}

/**
 * Resolve inputData for a service node from its parent chain.
 * - Group parent: first sibling gets group's inputData; others get previous sibling's outputData.
 * - Other parent (task/service/decision): gets parent's outputData.
 * - No parent or start parent: returns null.
 *
 * Uses array order in workingNodes to determine sibling pipeline order.
 */
function resolveInputData(
  node: WorkflowNode,
  workingNodes: WorkflowNode[],
): unknown {
  if (!node.parentNode) return null;

  const nodeMap = new Map(workingNodes.map((n) => [n.id, n]));
  const parent = nodeMap.get(node.parentNode);
  if (!parent || parent.type === "start") return null;

  if (parent.type === "group") {
    const siblings = workingNodes.filter(
      (n) => n.parentNode === node.parentNode,
    );
    const siblingIdx = siblings.findIndex((n) => n.id === node.id);

    if (siblingIdx <= 0) {
      // First child: inherit from group's inputData
      return parent.data.execution?.config?.nodeData?.inputData ?? null;
    }

    // Non-first child: inherit from previous sibling's outputData
    const prevSibling = siblings[siblingIdx - 1];
    return prevSibling?.data.execution?.config?.nodeData?.outputData ?? null;
  }

  // Standalone: parent is task / service / decision
  return parent.data.execution?.config?.nodeData?.outputData ?? null;
}

/**
 * Repair service nodes with missing functionCode, inputData, or outputData.
 * Deterministic repair — generates functionCode directly from node's http config.
 *
 * 1. Normalizes data.http defaults (uses AI-set values, falls back to defaults).
 * 2. Generates functionCode deterministically — always non-empty.
 * 3. Resolves inputData from the parent chain (flat array order = pipeline order).
 */
export async function repairServiceNodeFunctionCode(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  const workingNodes = [...context.nodes];

  for (let i = 0; i < workingNodes.length; i++) {
    const node = workingNodes[i];
    if (!isIncomplete(node)) continue;

    // 1. Normalize http defaults (use AI-set values, fall back to defaults)
    const http = {
      method: "GET" as const,
      endpoint: "",
      headers: { "Content-Type": "application/json" },
      body: {},
      ...(node.data as ServiceNodeData).http,
    };
    const normalizedData = { ...node.data, http };

    // 2. Generate functionCode deterministically — always non-empty
    const functionCode = generatePanelCode("service", normalizedData) ?? "";

    // 3. Resolve inputData from parent chain
    const inputData = resolveInputData(node, workingNodes);

    // 4. outputData는 step 12에서 설정됨
    const outputData = null;

    workingNodes[i] = {
      ...node,
      data: {
        ...normalizedData,
        execution: {
          ...node.data.execution,
          config: {
            ...node.data.execution?.config,
            functionCode,
            isAsync: true,
            nodeData: {
              inputData,
              outputData,
            },
          },
        },
      },
    };
  }

  return workingNodes;
}
