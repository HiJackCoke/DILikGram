/**
 * Intersection detection utilities for drag-and-drop operations
 */
import type { WorkflowNode } from "@/types/nodes";

/**
 * Node dimensions by type
 * Used for AABB collision detection
 */
const NODE_DIMENSIONS: Record<
  string,
  { width: number; height: number }
> = {
  start: { width: 96, height: 96 },
  end: { width: 96, height: 96 },
  task: { width: 200, height: 120 },
  decision: { width: 144, height: 144 },
  service: { width: 200, height: 120 },
  group: { width: 280, height: 200 },
};

/**
 * AABB (Axis-Aligned Bounding Box) collision detection
 * Checks if a point (x, y) is inside a node's bounding box
 *
 * @param x - Canvas X coordinate
 * @param y - Canvas Y coordinate
 * @param node - Node to check collision with
 * @returns True if point is inside node bounds
 */
export function isPointInNodeBounds(
  x: number,
  y: number,
  node: WorkflowNode,
): boolean {
  // Use positionAbsolute if available (more accurate during interactions)
  const nodeX = node.positionAbsolute?.x ?? node.position.x;
  const nodeY = node.positionAbsolute?.y ?? node.position.y;

  // Get node dimensions
  const { width, height } = NODE_DIMENSIONS[node.type || "task"] || {
    width: 200,
    height: 100,
  };

  // AABB collision test
  return (
    x >= nodeX &&
    x <= nodeX + width &&
    y >= nodeY &&
    y <= nodeY + height
  );
}

/**
 * Convert screen coordinates (clientX, clientY) to canvas coordinates
 * and find all nodes at that position
 *
 * @param x - Screen X coordinate (clientX)
 * @param y - Screen Y coordinate (clientY)
 * @param nodes - All workflow nodes
 * @param transform - react-cosmos-diagram transform [offsetX, offsetY, zoom]
 * @returns Array of nodes at the position
 */
export function getNodesAtPosition(
  x: number,
  y: number,
  nodes: WorkflowNode[],
  transform: [number, number, number],
): WorkflowNode[] {
  // Screen coordinates → Canvas coordinates
  const [offsetX, offsetY, zoom] = transform;
  const canvasX = (x - offsetX) / zoom;
  const canvasY = (y - offsetY) / zoom;

  // Find all nodes at this position
  return nodes.filter((node) =>
    isPointInNodeBounds(canvasX, canvasY, node),
  );
}

/**
 * Prioritize intersected nodes for drag-and-drop operations
 * Priority:
 * 1. Group nodes (highest)
 * 2. Regular nodes (task, service, decision)
 *
 * Start/End nodes are filtered out as they cannot be targets
 *
 * @param nodes - Intersected nodes
 * @returns Sorted nodes by priority
 */
export function prioritizeIntersectedNodes(
  nodes: WorkflowNode[],
): WorkflowNode[] {
  // Filter out Start/End nodes (they cannot be drop targets)
  const validNodes = nodes.filter(
    (node) => !["start", "end"].includes(node.type || ""),
  );

  // Sort: Group nodes first, then others
  return validNodes.sort((a, b) => {
    if (a.type === "group" && b.type !== "group") return -1;
    if (a.type !== "group" && b.type === "group") return 1;
    return 0;
  });
}
