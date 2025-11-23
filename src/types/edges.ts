import type { Edge, EdgeProps } from "react-cosmos-diagram";

export type WorkflowEdgeType = "default" | "success" | "error" | "warning";

export type WorkflowEdgeData = {
  edgeType?: WorkflowEdgeType;
  animated?: boolean;
};

export type WorkflowEdge = Edge<WorkflowEdgeData>;
export type WorkflowEdgeProps = EdgeProps<WorkflowEdge>;
