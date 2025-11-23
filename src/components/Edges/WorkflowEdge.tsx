import type { WorkflowEdgeProps, WorkflowEdgeType } from "@/types/edges";
import { getStepPath } from "react-cosmos-diagram";

// 엣지 타입별 색상 설정
const edgeColors: Record<
  WorkflowEdgeType,
  { stroke: string; gradient: [string, string] }
> = {
  default: {
    stroke: "#94a3b8", // slate-400
    gradient: ["#64748b", "#94a3b8"], // slate-500 -> slate-400
  },
  success: {
    stroke: "#22c55e", // green-500
    gradient: ["#16a34a", "#4ade80"], // green-600 -> green-400
  },
  error: {
    stroke: "#ef4444", // red-500
    gradient: ["#dc2626", "#f87171"], // red-600 -> red-400
  },
  warning: {
    stroke: "#eab308", // yellow-500
    gradient: ["#ca8a04", "#facc15"], // yellow-600 -> yellow-400
  },
};

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

  const colors = edgeColors[edgeType];

  // Smooth step path 사용 (더 깔끔한 직각 연결)
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

  return (
    <>
      {/* Gradient 정의 */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.gradient[0]} />
          <stop offset="100%" stopColor={colors.gradient[1]} />
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
      {label && labelX && labelY && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-20}
            y={-10}
            width={40}
            height={20}
            rx={4}
            fill="white"
            stroke={colors.stroke}
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
            {label}
          </text>
        </g>
      )}
    </>
  );
}
