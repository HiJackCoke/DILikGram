import { MarkerType } from "react-cosmos-diagram";

import type { WorkflowEdge } from "@/types/edges";

export const initialEdges: WorkflowEdge[] = [
  {
    id: "e-start-task1",
    source: "start-1",
    sourcePort: "output",
    target: "task-1",
    targetPort: "input",
    type: "workflow",
    data: { edgeType: "default", animated: false },
    markerEnd: {
      type: MarkerType.Arrow,
    },
  },
  {
    id: "e-task1-decision",
    source: "task-1",
    sourcePort: "output",
    target: "decision-1",
    targetPort: "input",
    type: "workflow",
    data: { edgeType: "success", animated: false },
    markerEnd: {
      type: MarkerType.Arrow,
    },
  },
  {
    id: "e-decision-service",
    source: "decision-1",
    sourcePort: "yes",
    target: "service-1",
    targetPort: "input",
    type: "workflow",
    label: "Yes",
    data: { edgeType: "success" },
    markerEnd: {
      type: MarkerType.Arrow,
    },
  },
  {
    id: "e-decision-task2",
    source: "decision-1",
    sourcePort: "no",
    target: "task-2",
    targetPort: "input",
    type: "workflow",
    label: "No",
    data: { edgeType: "error" },
    markerEnd: {
      type: MarkerType.Arrow,
    },
  },
  {
    id: "e-service-end",
    source: "service-1",
    sourcePort: "output",
    target: "end-success",
    targetPort: "input",
    type: "workflow",
    data: { edgeType: "success", animated: false },
    markerEnd: {
      type: MarkerType.Arrow,
    },
  },
  {
    id: "e-task2-end",
    source: "task-2",
    sourcePort: "output",
    target: "end-failure",
    targetPort: "input",
    type: "workflow",
    data: { edgeType: "error" },
    markerEnd: {
      type: MarkerType.Arrow,
    },
  },
];
