import { getStepPath } from "react-cosmos-diagram";
import { getEdgePaletteColor, getFriendlyLabel } from "./utils";

import type { WorkflowEdgeProps } from "@/types/edges";

export default function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,

  data,
}: WorkflowEdgeProps) {
  const edgeType = data?.edgeType || "default";
  const isAnimated = data?.animated ?? false;

  const COLORS = getEdgePaletteColor(edgeType);


  const [edgePath, labelX, labelY] = getStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const gradientId = `edge-gradient-${id}`;

  const transferData = data?.transferData;

  const dataIndicatorLabel = transferData
    ? getFriendlyLabel(transferData.dataType)
    : null;

  const displayLabel = label ?? dataIndicatorLabel;
  return (
    <>
      {/* Gradient 정의 */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={COLORS.bg} />
          <stop offset="100%" stopColor={COLORS.color} />
        </linearGradient>
      </defs>

      {/* 배경 선 (그림자 효과) */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={4}
        style={{ filter: "blur(2px)" }}
      />

      {/* 메인 엣지 */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="round"
        markerEnd={markerEnd}
        style={{
          ...style,
          transition: "stroke 0.2s ease",
        }}
        className={isAnimated ? "edge-animated" : ""}
      />

      {/* 라벨 */}
      {displayLabel && labelX && labelY && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-35}
            y={-15}
            width={70}
            height={30}
            rx={4}
            fill="white"
            stroke={COLORS.color}
            strokeWidth={1}
            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill="#374151"
            style={{ userSelect: "none" }}
          >
            {displayLabel}
          </text>
        </g>
      )}
    </>
  );
}
