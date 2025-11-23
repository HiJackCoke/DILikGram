import type { WorkflowEdgeType } from "@/types/edges";
import { PALETTE } from "../../../tailwind.config";

export const EDGE_COLORS: Record<WorkflowEdgeType, keyof typeof PALETTE> = {
  default: "neutral",
  success: "success",
  error: "danger",
  warning: "warning",
};

export const getEdgePaletteColor = (edgeType: WorkflowEdgeType) =>
  PALETTE[EDGE_COLORS[edgeType]];
