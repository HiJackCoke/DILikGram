import { StartNode } from "./StartNode";
import { EndNode } from "./EndNode";
import { TaskNode } from "./TaskNode";
import { DecisionNode } from "./DecisionNode";
import { ServiceNode } from "./ServiceNode";
import { GroupNode } from "./GroupNode";

// Node Types for ReactDiagram
export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  decision: DecisionNode,
  service: ServiceNode,
  group: GroupNode,
} as const;
