import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
} from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";

interface RuntimeIssue {
  node: WorkflowNode;
  issue: "execution_error" | "type_mismatch" | "null_return";
  details: string;
}

async function runSandbox(
  functionCode: string,
  inputData: unknown,
  outputData: unknown,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as any;
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => outputData,
      text: async () => JSON.stringify(outputData),
    });
    const fn = new AsyncFunction("inputData", "fetch", functionCode);
    const result = await Promise.race([
      fn(inputData, mockFetch),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout (5s)")), 5000),
      ),
    ]);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function topLevelKeys(obj: unknown): Set<string> {
  if (typeof obj !== "object" || obj === null) return new Set();
  return new Set(Object.keys(obj as Record<string, unknown>));
}

export async function validateServiceNodeRuntime(
  nodes: WorkflowNode[],
): Promise<ValidationResult> {
  const issues: RuntimeIssue[] = [];

  for (const node of nodes) {
    if (node.type !== "service") continue;
    const config = getExecutionConfig(node);
    const functionCode = config?.functionCode?.trim();
    const outputData = config?.nodeData?.outputData;

    // Only validate nodes that have both functionCode AND a non-null outputData to compare against.
    // null outputData means the service node hasn't been given mock data yet (e.g. DELETE 204).
    // undefined → caught by serviceNodeSimulation validator. null → skip (no mock data to compare).
    if (!functionCode || outputData === undefined || outputData === null) continue;

    const inputData = config?.nodeData?.inputData ?? null;

    // Skip runtime validation when inputData is null.
    // Self-contained service nodes (GET /resource) have intentional null inputData.
    // Service nodes that need inputData but have null (e.g. DELETE with body template)
    // are caught by the pipeline validator instead — no double-reporting needed.
    if (inputData === null) continue;

    const sandboxResult = await runSandbox(functionCode, inputData, outputData);

    if (!sandboxResult.ok) {
      issues.push({ node, issue: "execution_error", details: sandboxResult.error });
      continue;
    }

    const { result } = sandboxResult;
    if (result === null || result === undefined) {
      issues.push({
        node,
        issue: "null_return",
        details: "functionCode returned null or undefined",
      });
      continue;
    }

    // Check that outputData keys are present in result (extra keys in result are OK)
    const resultKeys = topLevelKeys(result);
    const mockKeys = topLevelKeys(outputData);
    const missingKeys = [...mockKeys].filter((k) => !resultKeys.has(k));

    if (missingKeys.length > 0) {
      issues.push({
        node,
        issue: "type_mismatch",
        details: `Return value missing keys from outputData: ${missingKeys.join(", ")}`,
      });
    }
  }

  if (issues.length === 0) return { valid: true };

  return {
    valid: false,
    errorType: "SERVICE_NODE_RUNTIME_TYPE_MISMATCH",
    errorMessage: `${issues.length} service node(s) have functionCode execution or type issues`,
    affectedNodes: issues.map((i) => i.node),
    metadata: { issues },
  };
}

