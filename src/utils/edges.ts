import { MarkerType } from "react-cosmos-diagram";
import { PALETTE } from "@/constants/palette";
import type { WorkflowEdge } from "@/types/edges";
import type { WorkflowNode } from "@/types";

export function generateEdgeId(sourceId: string, targetId: string): string {
  return `edge-${sourceId}-${targetId}`;
}

export function createDefaultEdge(edge: Partial<WorkflowEdge>): WorkflowEdge {
  // Ensure source and target exist
  if (!edge.source || !edge.target) {
    throw new Error("Edge must have source and target");
  }


  
  return {
    id: edge.id || generateEdgeId(edge.source, edge.target),
    type: edge.type || "workflow", // Ensure type is set
    source: edge.source,
    target: edge.target,
    sourcePort: edge.sourcePort || "output",
    targetPort: edge.targetPort || "input",
    markerEnd: edge.markerEnd || {
      type: MarkerType.Arrow,
      color: PALETTE["neutral"].color,
    },
    data: edge.data || {
      edgeType: "default",
      animated: false,
    },
  };
}


export function createWorkflowEdge(node: WorkflowNode) {
  const source = node.parentNode;
  const target = node.id;

  const targetPort = "input";
  const type = "workflow";

  return createDefaultEdge({
    source,
    target,
    sourcePort: node.data.branchLabel || "output",
    targetPort,
    type,
  });
}