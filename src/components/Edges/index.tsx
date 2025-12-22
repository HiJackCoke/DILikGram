import "@/styles/edges.css";

import WorkflowEdge from "./WorkflowEdge";

export * from "./utils";
// Edge Types for ReactDiagram
export const edgeTypes = {
  workflow: WorkflowEdge,
} as const;
