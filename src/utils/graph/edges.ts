import { MarkerType } from "react-cosmos-diagram";
import { PALETTE } from "@/constants/palette";
import type { WorkflowEdgeType, WorkflowNode, WorkflowEdge } from "@/types";

export const EDGE_COLORS: Record<WorkflowEdgeType, keyof typeof PALETTE> = {
  default: "neutral",
  success: "success",
  error: "danger",
  warning: "warning",
};

export const getEdgePaletteColor = (edgeType: WorkflowEdgeType) =>
  PALETTE[EDGE_COLORS[edgeType]];

/**
 * Convert technical data type to user-friendly label with icon
 */
export function getFriendlyLabel(dataType: string): string {
  const labelMap: Record<string, string> = {
    object: "📦 데이터",
    array: "📋 목록",
    string: "📝 텍스트",
    number: "🔢 숫자",
    boolean: "✓ 참/거짓",
    null: "∅ 빈값",
    undefined: "∅ 없음",
  };

  return labelMap[dataType] || labelMap["undefined"];
}

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
