import { MarkerType } from "react-cosmos-diagram";
import { PALETTE } from "../../tailwind.config";

export function generateEdgeId(sourceId: string, targetId: string): string {
  return `edge-${sourceId}-${targetId}`;
}

export function generateDefaultEdge(sourceId: string, targetId: string) {
  return {
    id: generateEdgeId(sourceId, targetId),
    type: "workflow",
    markerEnd: {
      type: MarkerType.Arrow,
      color: PALETTE["neutral"].color,
    },
  };
}
