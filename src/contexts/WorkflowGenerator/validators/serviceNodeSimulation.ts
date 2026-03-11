import type { WorkflowNode } from "@/types";
import type {
  ValidationResult,
  ValidationContext,
} from "../../../types/ai/validators";
import { getExecutionConfig } from "../utils/validationUtils";

function isMissingSimulationConfig(node: WorkflowNode): boolean {
  const config = getExecutionConfig(node);
  if (!config?.functionCode) return false; // functionCode 없는 service는 스킵

  const sim = config.simulation;
  return !sim?.enabled || sim?.mockResponse === undefined;
}

/**
 * Validate that all service nodes with functionCode have simulation config
 * (simulation.enabled = true AND simulation.mockResponse defined)
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
    errorMessage: `Found ${affected.length} service node(s) missing simulation.enabled or simulation.mockResponse`,
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
    const sim = config?.simulation;
    const missing: string[] = [];
    if (!sim?.enabled) missing.push("simulation.enabled = true");
    if (sim?.mockResponse === undefined)
      missing.push("simulation.mockResponse (realistic mock data)");

    const fixPrompt = `The service node "${node.data.title ?? "Untitled"}" (id: ${node.id}) is missing required simulation config.

functionCode: ${config?.functionCode ?? "(none)"}
Current simulation config: ${JSON.stringify(sim ?? null)}
nodeData.outputData: ${JSON.stringify(config?.nodeData?.outputData ?? null)}

MISSING: ${missing.join(", ")}

RULE: ALL service nodes MUST have:
1. execution.config.simulation.enabled = true
2. execution.config.simulation.mockResponse — realistic mock data matching what the real API would return

IMPORTANT:
- mockResponse must reflect the actual structure downstream nodes depend on
- If a decision node follows, include a "success" field: e.g. { "success": true, "data": {...} }
- Do NOT use placeholder values like null or empty objects — use realistic example data

Set both fields now.`;

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
