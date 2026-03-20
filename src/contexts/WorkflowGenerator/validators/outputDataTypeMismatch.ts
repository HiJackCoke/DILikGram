import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";
import { compileExecutor, executeFunction } from "@/utils/workflow/runtime";
import { getDataType } from "@/utils/workflow/helpers";

/** 최상위 타입 + 키 존재 + 키별 타입 비교 (depth=1) */
function typeShapeMatches(expected: unknown, actual: unknown): boolean {
  const expectedType = getDataType(expected);
  const actualType = getDataType(actual);
  if (expectedType !== actualType) return false;

  if (expectedType === "object" && expected !== null && actual !== null) {
    const expectedEntries = Object.entries(
      expected as Record<string, unknown>,
    );
    const actualObj = actual as Record<string, unknown>;
    return expectedEntries.every(([key, expectedVal]) => {
      if (!(key in actualObj)) return false;
      return getDataType(actualObj[key]) === getDataType(expectedVal);
    });
  }
  return true;
}

type MismatchDetail = {
  node: WorkflowNode;
  inputData: unknown;
  expectedOutput: unknown;
  actualOutput: unknown;
};

async function collectMismatches(
  nodes: WorkflowNode[],
): Promise<MismatchDetail[]> {
  const mismatches: MismatchDetail[] = [];

  for (const node of nodes) {
    if (node.type !== "task" && node.type !== "decision") continue;
    const config = getExecutionConfig(node);
    if (!config?.functionCode) continue;
    const expectedOutput = config.nodeData?.outputData;
    if (expectedOutput === undefined || expectedOutput === null) continue;

    try {
      const executorFn = compileExecutor(config, node.type);
      const result = await executeFunction(
        executorFn,
        config.nodeData?.inputData ?? null,
        5000,
      );
      if (!result.success) continue; // 실행 오류는 다른 validator가 처리
      if (!typeShapeMatches(expectedOutput, result.data)) {
        mismatches.push({
          node,
          inputData: config.nodeData?.inputData ?? null,
          expectedOutput,
          actualOutput: result.data,
        });
      }
    } catch {
      continue; // 컴파일 오류는 스킵
    }
  }

  return mismatches;
}

/**
 * Validate that functionCode return type matches declared outputData shape
 * Checks Task and Decision nodes only (sync, no network)
 */
export async function validateOutputDataTypeMismatch(
  nodes: WorkflowNode[],
): Promise<ValidationResult> {
  const mismatches = await collectMismatches(nodes);

  if (mismatches.length === 0) return { valid: true };

  return {
    valid: false,
    errorType: "OUTPUT_DATA_TYPE_MISMATCH",
    errorMessage: `Found ${mismatches.length} node(s) where functionCode return type ≠ declared outputData`,
    affectedNodes: mismatches.map((m) => m.node),
    metadata: { mismatches },
  };
}

/**
 * Repair outputData type mismatches by asking AI to fix the discrepancy
 */
export async function repairOutputDataTypeMismatch(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];
  const mismatches = await collectMismatches(workingNodes);

  for (const { node, inputData, expectedOutput, actualOutput } of mismatches) {
    const config = getExecutionConfig(node);
    if (!config?.functionCode) continue;

    const fixPrompt = buildFixPrompt(
      node,
      config.functionCode,
      inputData,
      expectedOutput,
      actualOutput,
    );
    const editResult = await context.updateWorkflowAction({
      targetNodeIds: [node.id],
      prompt: fixPrompt,
      nodes: workingNodes,
    });

    // Apply updates (same pattern as functionCodeMismatch.ts)
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

  return workingNodes;
}

function buildFixPrompt(
  node: WorkflowNode,
  functionCode: string,
  inputData: unknown,
  expectedOutput: unknown,
  actualOutput: unknown,
): string {
  const expectedKeys = Object.keys(
    (expectedOutput as Record<string, unknown>) ?? {},
  );
  const actualKeys = Object.keys(
    (actualOutput as Record<string, unknown>) ?? {},
  );

  return `The node "${node.data.title ?? "Untitled"}" (id: ${node.id}) has a type mismatch.

inputData: ${JSON.stringify(inputData)}
functionCode: ${functionCode}
Actual return value: ${JSON.stringify(actualOutput)}   ← keys: [${actualKeys.join(", ")}]
Declared nodeData.outputData: ${JSON.stringify(expectedOutput)}   ← keys: [${expectedKeys.join(", ")}]

PROBLEM: functionCode does not return the declared outputData shape.
Downstream nodes depend on outputData keys: [${expectedKeys.join(", ")}]

FIX OPTION 1 (preferred): Update functionCode to return a value matching outputData shape.
FIX OPTION 2: Update nodeData.outputData to match what functionCode actually returns AND update downstream nodes accordingly.

Choose the option that preserves the intended data contract.`;
}
