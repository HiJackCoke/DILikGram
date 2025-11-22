import "@/styles/ports.css";

import { StartNode } from "./StartNode";

// Node Types for ReactDiagram
export const nodeTypes = {
  start: StartNode,
} as const;
