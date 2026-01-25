import { Position } from "react-cosmos-diagram";
import type { WorkflowNode } from "@/types/nodes";

export function generateNodeId(index: number, type: string): string {
  return `${type}-${Date.now()}-${index}`;
}

export function getDefaultPorts(type: string) {
  switch (type) {
    case "start":
      return [
        { id: "output", position: Position.Bottom, type: "source" as const },
      ];
    case "end":
      return [{ id: "input", position: Position.Top, type: "target" as const }];
    case "task":
    case "service":
      return [
        { id: "input", position: Position.Top, type: "target" as const },
        { id: "output", position: Position.Bottom, type: "source" as const },
      ];
    case "decision":
      return [
        { id: "input", position: Position.Top, type: "target" as const },
        {
          id: "yes",
          position: Position.Right,
          type: "source" as const,
          label: "Yes",
        },
        {
          id: "no",
          position: Position.Bottom,
          type: "source" as const,
          label: "No",
        },
      ];
    default:
      return [];
  }
}

export function findAllDescendantNodes(
  nodes: WorkflowNode[],
  rootIds: Set<string>
): Set<string> {
  const result = new Set(rootIds);
  const queue = Array.from(rootIds);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const children = nodes.filter((node) => node.parentNode === currentId);

    for (const child of children) {
      if (result.has(child.id)) continue;

      // Skip END nodes
      if (child.type === "end") continue;

      result.add(child.id);
      queue.push(child.id);
    }
  }

  return result;
}
