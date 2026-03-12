import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import type { ServiceNodeData } from "@/types/nodes";
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

    // Only validate nodes that have both functionCode AND outputData to compare against
    if (!functionCode || outputData === undefined) continue;

    const inputData = config?.nodeData?.inputData ?? null;
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

/** Repair: AI에게 실행 결과와 기대 타입을 알려주고 functionCode 수정 요청 */
export async function repairServiceNodeRuntime(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];
  const result = await validateServiceNodeRuntime(workingNodes);
  if (result.valid) return workingNodes;

  const issues = result.metadata?.issues as RuntimeIssue[] | undefined;
  if (!issues?.length) return workingNodes;

  for (const { node, issue, details } of issues) {
    const config = getExecutionConfig(node);
    const outputData = config?.nodeData?.outputData;
    const data = node.data as ServiceNodeData;

    const fixPrompt =
      `CRITICAL: Service node "${data.title ?? "Untitled"}" (id: ${node.id}) has a functionCode runtime issue.\n\n` +
      `Issue: ${issue} — ${details}\n\n` +
      `Current functionCode:\n\`\`\`javascript\n${config?.functionCode ?? "(empty)"}\n\`\`\`\n\n` +
      `Expected outputData type:\n${JSON.stringify(outputData, null, 2)}\n\n` +
      `REQUIREMENT: The functionCode MUST return an object with at least these top-level keys: ` +
      `${[...topLevelKeys(outputData)].join(", ")}\n\n` +
      `FIX: Rewrite the functionCode so that:\n` +
      `1. It is a valid async function body (no "async function" wrapper)\n` +
      `2. It uses fetch to call the API\n` +
      `3. It returns await response.json() (which should match the outputData structure)\n` +
      `4. It has proper error handling with try/catch\n` +
      `5. The return value's top-level keys include: ${[...topLevelKeys(outputData)].join(", ")}`;

    const editResult = await context.updateWorkflowAction(
      node.id,
      fixPrompt,
      workingNodes,
    );

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
    if (editResult.nodes.create?.length)
      workingNodes = [...workingNodes, ...editResult.nodes.create];
    if (editResult.nodes.delete?.length) {
      const del = new Set(editResult.nodes.delete);
      workingNodes = workingNodes.filter((n) => !del.has(n.id));
    }
  }

  return workingNodes;
}
