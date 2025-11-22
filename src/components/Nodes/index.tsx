import "@/styles/ports.css";

import { StartNode } from "./StartNode";
import { EndNode } from "./EndNode";
import { TaskNode } from "./TaskNode";

// Node Types for ReactDiagram
export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
} as const;
