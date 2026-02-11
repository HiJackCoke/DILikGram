import { v4 as uuid } from "uuid";

import { Position } from "react-cosmos-diagram";

import type { NodePort, WorkflowNode } from "@/types/nodes";
import { UNIFIED_NODE_TEMPLATES } from "@/fixtures/nodes";

export function generateNodeId(type: string): string {
  const id = uuid();
  return `node-${type}-${id}`;
}

export function getDefaultPorts(type: string): NodePort[] {
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
    case "group":
      // Group 노드는 항상 input(left) + output(right)
      return [
        { id: "input", position: Position.Top, type: "target" as const },
        { id: "output", position: Position.Bottom, type: "source" as const },
      ];
    default:
      return [];
  }
}

export function findAllDescendantNodes(
  nodes: WorkflowNode[],
  rootIds: Set<string>,
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

export function findLeafNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  // 1. parent로 사용된 node id들을 수집
  const parentNodeSet = new Set<string>();

  nodes.forEach((node) => {
    if (node.parentNode) {
      parentNodeSet.add(node.parentNode);
    }
  });

  // 2. parent로 한 번도 등장하지 않은 노드가 leaf
  return nodes.filter((node) => !parentNodeSet.has(node.id));
}

export function createDefaultNode(node: Partial<WorkflowNode>) {
  const type = node.type || "start";
  const template = UNIFIED_NODE_TEMPLATES[type].template;

  const newNode: WorkflowNode = {
    id: node.id || generateNodeId(type),
    position: { x: 0, y: 0 },
    ...template,
    ...node,
  };

  return newNode;
}
