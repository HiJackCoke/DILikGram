import type { Edge, EdgeProps } from "react-cosmos-diagram";

export type WorkflowEdgeType = "default" | "success" | "error" | "warning";

type WorkflowEdgeData = {
  edgeType?: WorkflowEdgeType;
  animated?: boolean;

  // 데이터 전달 정보
  transferData?: EdgeTransferData;
};

export type EdgeTransferData = {
  payload: unknown; // 전달된 데이터
  dataType: string; // "object", "array", "string" 등
  timestamp: number;
};

export type WorkflowEdge = Edge<WorkflowEdgeData>;
export type WorkflowEdgeProps = EdgeProps<WorkflowEdge>;
