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
