import "@/styles/ports.css";

import { StartNode } from "./StartNode";
import { EndNode } from "./EndNode";
import { TaskNode } from "./TaskNode";
import { DecisionNode } from "./DecisionNode";

// Node Types for ReactDiagram
export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  decision: DecisionNode,
} as const;
