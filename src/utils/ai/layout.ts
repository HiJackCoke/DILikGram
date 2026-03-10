/**
 * Tree-based layout algorithm for workflow node positioning
 *
 * This module provides automatic positioning for AI-generated workflows,
 * ensuring no overlaps and proper visual hierarchy.
 */

import type { WorkflowNode } from "@/types/nodes";

/**
 * Layout constants derived from manual mock data analysis
 */
const LAYOUT_CONSTANTS = {
  /** Vertical spacing between hierarchy levels */
  VERTICAL_SPACING: 150,

  /** Horizontal spacing between siblings */
  HORIZONTAL_SPACING: 300,

  /** Decision node branch offsets */
  DECISION_BRANCH_OFFSET: {
    yes: 250, // Right branch offset
    no: -50, // Left/bottom branch offset
  },

  /** Starting Y position for root nodes */
  START_Y: 100,

  /** Starting X position for root nodes */
  START_X: 300,

  /** Vertical gap between independent page subtrees */
  SUBTREE_ROW_GAP: 300,

  /** Approximate node dimensions for collision detection */
  NODE_WIDTH: 200,
  NODE_HEIGHT: 100,

  /** Extra buffer between nodes */
  COLLISION_PADDING: 50,
};

/**
 * Extended node type with layout metadata
 */
interface LayoutNode extends WorkflowNode {
  // depth: number;
  siblingIndex: number;
  // parentNode?: string;
}

/**
 * Main entry point for calculating node positions
 *
 * @param nodes - Nodes to position
 * @param existingNodes - Existing nodes on canvas (for collision detection)
 * @returns Nodes with calculated positions
 */
export function calculateNodePositions(
  nodes: WorkflowNode[],
  // existingNodes: WorkflowNode[] = [],
): WorkflowNode[] {
  if (nodes.length === 0) return [];

  // Step 1: Calculate depth for each node
  // const nodesWithDepth = calculateDepths(nodes);

  // Step 2: Group by parent and assign sibling indices
  const nodesWithSiblings = assignSiblingIndices(nodes);

  // Step 3: Calculate positions based on depth, siblings, and branch type
  const positionedNodes = applyPositioning(nodesWithSiblings);

  // Step 4: Detect and resolve collisions with existing nodes
  // const finalNodes = resolveCollisions(positionedNodes, existingNodes);

  // return finalNodes;
  return positionedNodes;
}

/**
 * Calculate depth for each node using BFS traversal
 *
 * @param nodes - Input nodes
 * @returns Nodes with depth metadata
 */
// function calculateDepths(nodes: WorkflowNode[]): LayoutNode[] {
//   // Find root nodes (no parentNode)
//   const roots = nodes.filter((n) => !n.parentNode);

//   // BFS to assign depth
//   const depthMap = new Map<string, number>();
//   const queue: Array<{ id: string; depth: number }> = roots.map((r) => ({
//     id: r.id,
//     depth: 0,
//   }));

//   while (queue.length > 0) {
//     const { id, depth } = queue.shift()!;
//     depthMap.set(id, depth);

//     // Find children
//     const children = nodes.filter((n) => n.parentNode === id);
//     children.forEach((child) => {
//       queue.push({ id: child.id, depth: depth + 1 });
//     });
//   }

//   return nodes.map((node) => ({
//     ...node,
//     depth: depthMap.get(node.id) ?? 0,
//     siblingIndex: 0,
//     parentNode: node.parentNode,
//   }));
// }

/**
 * Assign sibling indices within parent groups
 *
 * @param nodes - Nodes with depth
 * @returns Nodes with sibling index metadata
 */
function assignSiblingIndices(nodes: WorkflowNode[]): LayoutNode[] {
  // Group by parent
  const siblingGroups = new Map<string | undefined, WorkflowNode[]>();

  nodes.forEach((node) => {
    const key = node.parentNode ?? "root";
    if (!siblingGroups.has(key)) {
      siblingGroups.set(key, []);
    }
    siblingGroups.get(key)!.push(node);
  });

  // Assign indices within each group
  return nodes.map((node) => {
    const key = node.parentNode ?? "root";
    const siblings = siblingGroups.get(key)!;
    const index = siblings.findIndex((s) => s.id === node.id);

    return {
      ...node,
      siblingIndex: index,
    };
  });
}

/**
 * Sort nodes topologically so parents are always processed before children
 *
 * @param nodes - Nodes to sort
 * @returns Topologically sorted nodes
 */
function topologicalSortNodes(nodes: LayoutNode[]): LayoutNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result: LayoutNode[] = [];
  const visited = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return;
    if (node.parentNode && nodeMap.has(node.parentNode)) visit(node.parentNode);
    result.push(node);
  }

  nodes.forEach((n) => visit(n.id));
  return result;
}

/**
 * Get the maximum depth of a subtree rooted at the given node ID
 *
 * @param nodes - All layout nodes
 * @param rootId - Root node ID to start from
 * @returns Maximum depth in the subtree
 */
function getSubtreeMaxDepth(nodes: LayoutNode[], rootId: string): number {
  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);

    const children = nodes.filter((n) => n.parentNode === id);
    children.forEach((child) => {
      queue.push({ id: child.id, depth: depth + 1 });
    });
  }

  return maxDepth;
}

/**
 * Calculate absolute Y start positions for each root node (vertical stacking)
 *
 * @param nodes - All layout nodes
 * @param rootNodes - Root nodes in order
 * @returns Map from root node ID to absolute Y position
 */
function calculateRootYOffsets(nodes: LayoutNode[], rootNodes: LayoutNode[]): Map<string, number> {
  const offsets = new Map<string, number>();
  const nodeHeight = LAYOUT_CONSTANTS.VERTICAL_SPACING + LAYOUT_CONSTANTS.NODE_WIDTH;
  let currentY = LAYOUT_CONSTANTS.START_Y;

  for (const root of rootNodes) {
    offsets.set(root.id, currentY);
    const maxDepth = getSubtreeMaxDepth(nodes, root.id);
    currentY += (maxDepth + 1) * nodeHeight + LAYOUT_CONSTANTS.SUBTREE_ROW_GAP;
  }

  return offsets;
}

/**
 * Apply positioning rules based on hierarchy and branch type.
 * Uses topological sort so parent positions are computed before children reference them.
 * Root nodes (no parentNode) are stacked vertically in order.
 *
 * @param nodes - Nodes with depth and sibling metadata
 * @returns Nodes with calculated positions
 */
function applyPositioning(nodes: LayoutNode[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const computedPositions = new Map<string, { x: number; y: number }>();
  const sorted = topologicalSortNodes(nodes);
  const rootNodes = sorted.filter((n) => !n.parentNode);
  const rootYOffsets = calculateRootYOffsets(nodes, rootNodes);
  const resultMap = new Map<string, WorkflowNode>();

  for (const node of sorted) {
    const parent = node.parentNode ? nodeMap.get(node.parentNode) : null;
    const parentPos = node.parentNode
      ? computedPositions.get(node.parentNode)
      : null;

    const nodeWidth = node.width ?? LAYOUT_CONSTANTS.NODE_WIDTH;
    const y = LAYOUT_CONSTANTS.VERTICAL_SPACING + nodeWidth;

    let x: number;

    if (!parentPos) {
      // Root node: stack vertically, all at the same X
      x = LAYOUT_CONSTANTS.START_X;
      const rootY = rootYOffsets.get(node.id) ?? LAYOUT_CONSTANTS.START_Y;
      computedPositions.set(node.id, { x, y: rootY });
      resultMap.set(node.id, { ...node, position: { x, y: rootY } });
      continue;
    } else if (parent?.type === "decision") {
      // Decision branch: special handling
      const branchLabel = node.data.branchLabel as "yes" | "no" | undefined;
      const offset =
        branchLabel === "yes"
          ? LAYOUT_CONSTANTS.DECISION_BRANCH_OFFSET.yes
          : LAYOUT_CONSTANTS.DECISION_BRANCH_OFFSET.no;
      x = parentPos.x + offset;
    } else {
      // Regular sibling: centered spread around parent
      const siblingCount = getSiblingCount(nodes, node.parentNode!);
      const siblingOffset =
        (node.siblingIndex - (siblingCount - 1) / 2) *
        LAYOUT_CONSTANTS.HORIZONTAL_SPACING;
      x = parentPos.x + siblingOffset;
    }

    computedPositions.set(node.id, { x, y });
    resultMap.set(node.id, { ...node, position: { x, y } });
  }

  // Return in original order
  return nodes.map((n) => resultMap.get(n.id)!);
}

/**
 * Count siblings with the same parent
 *
 * @param nodes - All nodes
 * @param parentNode - Parent node ID
 * @returns Number of siblings
 */
function getSiblingCount(nodes: LayoutNode[], parentNode: string): number {
  return nodes.filter((n) => n.parentNode === parentNode).length;
}

/**
 * Resolve collisions with existing canvas nodes
 *
 * @param newNodes - Newly positioned nodes
 * @param existingNodes - Existing nodes on canvas
 * @returns Nodes with collision-free positions
 */
// function resolveCollisions(
//   newNodes: WorkflowNode[],
//   existingNodes: WorkflowNode[],
// ): WorkflowNode[] {
//   if (existingNodes.length === 0) return newNodes;

//   const existingBounds = existingNodes.map(getBoundingBox);

//   // Check if any new node collides with existing nodes
//   let hasCollision = false;
//   for (const newNode of newNodes) {
//     const newBounds = getBoundingBox(newNode);

//     for (const existing of existingBounds) {
//       if (boxesIntersect(newBounds, existing)) {
//         hasCollision = true;
//         break;
//       }
//     }

//     if (hasCollision) break;
//   }

//   // If collision detected, offset entire new workflow downward
//   if (hasCollision) {
//     const maxExistingY = Math.max(...existingNodes.map((n) => n.position.y));
//     // Add node height + spacing to create consistent gap below existing nodes
//     const offsetY =
//       maxExistingY +
//       LAYOUT_CONSTANTS.NODE_HEIGHT +
//       LAYOUT_CONSTANTS.VERTICAL_SPACING;

//     console.log(
//       234234,
//       maxExistingY,
//       LAYOUT_CONSTANTS.NODE_HEIGHT,
//       LAYOUT_CONSTANTS.VERTICAL_SPACING,
//       newNodes,
//     );
//     return newNodes.map((node) => ({
//       ...node,
//       position: {
//         x: node.position.x,
//         y: node.position.y + offsetY,
//       },
//     }));
//   }

//   return newNodes;
// }

/**
 * Calculate bounding box for collision detection
 *
 * @param node - Node to calculate bounds for
 * @returns Bounding box
 */
// function getBoundingBox(node: WorkflowNode): Rect {
//   return {
//     x: node.position.x - LAYOUT_CONSTANTS.NODE_WIDTH / 2,
//     y: node.position.y - LAYOUT_CONSTANTS.NODE_HEIGHT / 2,
//     width: LAYOUT_CONSTANTS.NODE_WIDTH + LAYOUT_CONSTANTS.COLLISION_PADDING,
//     height: LAYOUT_CONSTANTS.NODE_HEIGHT + LAYOUT_CONSTANTS.COLLISION_PADDING,
//   };
// }

/**
 * Check if two bounding boxes intersect
 *
 * @param a - First bounding box
 * @param b - Second bounding box
 * @returns True if boxes intersect
 */
// function boxesIntersect(a: Rect, b: Rect): boolean {
//   return !(
//     a.x + a.width < b.x ||
//     b.x + b.width < a.x ||
//     a.y + a.height < b.y ||
//     b.y + b.height < a.y
//   );
// }
