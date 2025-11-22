import "@/styles/ports.css";

import { EndNode } from "./EndNode";

import { StartNode } from "./StartNode";

// Node Types for ReactDiagram
export const nodeTypes = {
  start: StartNode,
  end: EndNode,
} as const;
