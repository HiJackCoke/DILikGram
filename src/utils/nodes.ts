import { Position } from "react-cosmos-diagram";

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
