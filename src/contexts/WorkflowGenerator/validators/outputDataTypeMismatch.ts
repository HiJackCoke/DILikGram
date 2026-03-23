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
 * Deterministic repair: if functionCode executes successfully and its actual return value
 * has a different shape than declared outputData, update outputData to match the actual result.
 *
 * Safe because:
 * - outputData is a sample/schema declaration, not a runtime contract
 * - We preserve 3+ element arrays from existing outputData when actual has fewer (to avoid EMPTY_DATA_SHAPE)
 * - We never change functionCode
 */
export async function deterministicRepairOutputDataTypeMismatch(
  nodes: WorkflowNode[],
): Promise<WorkflowNode[]> {
  const result = [...nodes];

  for (let i = 0; i < result.length; i++) {
    const node = result[i];
    // Only task nodes have user-written functionCode (service/decision are auto-generated)
    if (node.type !== "task") continue;

    const config = getExecutionConfig(node);
    if (!config?.functionCode?.trim()) continue;

    const expectedOutput = config.nodeData?.outputData;
    // Only fix when outputData is declared as a non-null object (has keys to compare)
    if (
      expectedOutput === null ||
      expectedOutput === undefined ||
      typeof expectedOutput !== "object" ||
      Array.isArray(expectedOutput)
    ) continue;

    try {
      const executorFn = compileExecutor(config, node.type);
      const execResult = await executeFunction(
        executorFn,
        config.nodeData?.inputData ?? null,
        5000,
      );

      if (!execResult.success) continue; // runtime error — leave for AI
      if (
        execResult.data === null ||
        execResult.data === undefined ||
        typeof execResult.data !== "object" ||
        Array.isArray(execResult.data)
      ) continue;

      if (typeShapeMatches(expectedOutput, execResult.data)) continue; // already correct

      const actualData = execResult.data as Record<string, unknown>;
      const expectedObj = expectedOutput as Record<string, unknown>;

      // Guard: if functionCode is a passthrough of inputData while declared outputData has keys
      // NOT in inputData, the declared outputData was set as a schema hint (e.g., Strategy G).
      // Reverting it would undo the pipeline alignment — skip and let AI write the real logic.
      const inputData = config.nodeData?.inputData;
      if (inputData !== null && typeof inputData === "object" && !Array.isArray(inputData)) {
        const inputKeys = new Set(Object.keys(inputData as object));
        const actualKeys = Object.keys(actualData);
        const expectedKeys = Object.keys(expectedObj);
        const isActualSubsetOfInput = actualKeys.every(k => inputKeys.has(k));
        const expectedHasNonInputKeys = expectedKeys.some(k => !inputKeys.has(k));
        if (isActualSubsetOfInput && expectedHasNonInputKeys) continue;
      }

      // Build new outputData using actual structure, preserving rich sample arrays from existing outputData
      const newOutputData: Record<string, unknown> = {};
      for (const [key, actualValue] of Object.entries(actualData)) {
        const existingValue = expectedObj[key];
        // Preserve existing array when it has 3+ items and actual has fewer (same element type)
        if (
          Array.isArray(actualValue) &&
          actualValue.length < 3 &&
          Array.isArray(existingValue) &&
          existingValue.length >= 3 &&
          (actualValue.length === 0 || getDataType(actualValue[0]) === getDataType(existingValue[0]))
        ) {
          newOutputData[key] = existingValue;
        } else {
          newOutputData[key] = actualValue;
        }
      }

      result[i] = {
        ...node,
        data: {
          ...node.data,
          execution: {
            ...node.data.execution,
            config: {
              ...config,
              nodeData: {
                ...config.nodeData,
                outputData: newOutputData,
              },
            },
          },
        },
      };

      console.log(
        `[deterministicRepairOutputDataTypeMismatch] Fixed outputData keys for ${node.id}: ${Object.keys(actualData).join(", ")} (was: ${Object.keys(expectedObj).join(", ")})`,
      );
    } catch {
      continue;
    }
  }

  return result;
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
