import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";

function isMissingSimulationConfig(node: WorkflowNode): boolean {
  const config = getExecutionConfig(node);
  if (!config?.functionCode?.trim()) return false; // empty/missing functionCode → skip (fixed by prior validator)

  return config?.nodeData?.outputData === undefined;
}

/**
 * Validate that all service nodes with functionCode have simulation config
 * (nodeData.outputData defined)
 */
export function validateServiceNodeSimulation(
  nodes: WorkflowNode[],
): ValidationResult {
  const affected = nodes.filter(
    (n) => n.type === "service" && isMissingSimulationConfig(n),
  );

  if (affected.length === 0) return { valid: true };

  return {
    valid: false,
    errorType: "SERVICE_NODE_SIMULATION_MISSING",
    errorMessage: `Found ${affected.length} service node(s) missing nodeData.outputData`,
    affectedNodes: affected,
  };
}

/**
 * Repair service nodes missing simulation config by asking AI to add them
 */
export async function repairServiceNodeSimulation(
  context: ValidationContext,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];
  const affected = workingNodes.filter(
    (n) => n.type === "service" && isMissingSimulationConfig(n),
  );

  for (const node of affected) {
    const config = getExecutionConfig(node);
    const missing: string[] = [];
    if (config?.nodeData?.outputData === undefined)
      missing.push("nodeData.outputData (realistic mock data)");

    const fixPrompt = `The service node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is missing required simulation config.

functionCode: ${config?.functionCode ?? "(none)"}
nodeData.outputData: ${JSON.stringify(config?.nodeData?.outputData ?? null)}

MISSING: ${missing.join(", ")}

RULE: ALL service nodes MUST have:
1. execution.config.nodeData.outputData — realistic mock data matching what the real API would return

IMPORTANT:
- nodeData.outputData must reflect the actual structure downstream nodes depend on
- If a decision node follows, include a "success" field: e.g. { "success": true, "data": {...} }
- Do NOT use placeholder values like null or empty objects — use realistic example data

Set the field now.`;

    const editResult = await context.updateWorkflowAction(
      node.id,
      fixPrompt,
      workingNodes,
    );

    if (editResult.nodes.update?.length) {
      editResult.nodes.update.forEach((update) => {
        const idx = workingNodes.findIndex((n) => n.id === update.id);
        if (idx >= 0) {
          // Save functionCode BEFORE shallow merge (set by step 11 repair)
          const originalFunctionCode =
            workingNodes[idx].data.execution?.config?.functionCode;

          workingNodes[idx] = {
            ...workingNodes[idx],
            data: { ...workingNodes[idx].data, ...update.data },
            parentNode: update.parentNode || workingNodes[idx].parentNode,
          };

          // RESTORE functionCode (step 12 asks for simulation, not functionCode)
          const updatedConfig = workingNodes[idx].data.execution?.config;
          if (updatedConfig && originalFunctionCode !== undefined) {
            workingNodes[idx] = {
              ...workingNodes[idx],
              data: {
                ...workingNodes[idx].data,
                execution: {
                  ...workingNodes[idx].data.execution,
                  config: {
                    ...updatedConfig,
                    functionCode: originalFunctionCode,
                  },
                },
              },
            };
          }
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
