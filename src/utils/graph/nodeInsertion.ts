/**
 * Node insertion and connection utilities for drag-and-drop operations
 */
import { MarkerType } from "react-cosmos-diagram";
import type { WorkflowNode, GroupNodeData } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";
import { generateEdgeId } from "./edges";
import { PALETTE } from "@/constants/palette";

/**
 * Validate if a node can be inserted into a group node
 * Reuses validation logic from handleOnNodeDragEnd
 *
 * @param draggingNode - Node being dropped
 * @param targetGroup - Group node to insert into
 * @param allNodes - All nodes in the workflow
 * @returns Validation result with optional reason
 */
export function canInsertIntoGroup(
  draggingNode: WorkflowNode,
  targetGroup: WorkflowNode,
  allNodes: WorkflowNode[],
): { valid: boolean; reason?: string } {
  // 1. Exception nodes: start, end, group cannot be inserted into groups
  if (["start", "end", "group"].includes(draggingNode.type || "")) {
    return {
      valid: false,
      reason: "Cannot insert start/end/group nodes into group",
    };
  }

  // 2. Target must be a group node
  if (targetGroup.type !== "group") {
    return { valid: false, reason: "Target is not a group node" };
  }

  // 3. Dragging node already has a parent (defensive check for panel drops)
  if (draggingNode.parentNode) {
    return { valid: false, reason: "Node already has a parent" };
  }

  // 4. Dragging node has children (cannot move parent into group)
  const hasChildren = allNodes.some(
    (node) => node.parentNode === draggingNode.id,
  );
  if (hasChildren) {
    return {
      valid: false,
      reason: "Cannot insert node with children into group",
    };
  }

  return { valid: true };
}

/**
 * Insert a node into a group's internal nodes array
 * Extracted from handleOnNodeDragEnd logic
 *
 * @param nodes - All workflow nodes
 * @param nodeToInsert - Node to add to group
 * @param targetGroupId - ID of target group node
 * @returns Updated nodes array with node inserted into group
 */
export function insertNodeIntoGroup(
  nodes: WorkflowNode[],
  nodeToInsert: WorkflowNode,
  targetGroupId: string,
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.id === targetGroupId && node.type === "group") {
      const groupData = node.data as GroupNodeData;
      return {
        ...node,
        data: {
          ...node.data,
          groups: [...(groupData.groups || []), nodeToInsert],
        },
      };
    }
    return node;
  });
}

/**
 * Validate if two nodes can be automatically connected
 * Reuses validation logic from onConnect
 *
 * @param sourceNode - Node to connect from (existing node)
 * @param targetNode - Node to connect to (newly dropped node)
 * @param existingEdges - All existing edges
 * @returns Validation result with optional reason
 */
export function canAutoConnect(
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
  existingEdges: WorkflowEdge[],
): { valid: boolean; reason?: string } {
  // 1. Start node cannot have incoming edges
  if (targetNode.type === "start") {
    return {
      valid: false,
      reason: "Start node cannot have incoming edges",
    };
  }

  // 2. End node cannot be a source
  if (sourceNode.type === "end") {
    return {
      valid: false,
      reason: "End node cannot have outgoing edges",
    };
  }

  // 3. Target node already has a parent (one parent per node rule)
  const hasParent = existingEdges.some((edge) => edge.target === targetNode.id);
  if (hasParent) {
    return {
      valid: false,
      reason: "Target node already has a parent",
    };
  }

  return { valid: true };
}

/**
 * Calculate relative position for child node
 * Reuses logic from onConnect
 *
 * @param childPosition - Child node's absolute position
 * @param parentPosition - Parent node's absolute position
 * @returns Relative position
 */
export function calculateRelativePosition(
  childPosition: { x: number; y: number },
  parentPosition: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: childPosition.x - parentPosition.x,
    y: childPosition.y - parentPosition.y,
  };
}

/**
 * Get auto-connect port names based on node type
 * Decision nodes use "yes" as default source port
 * Other nodes use "output"
 *
 * @param sourceNode - Source node
 * @returns Port names for connection
 */
export function getAutoConnectPorts(sourceNode: WorkflowNode): {
  sourcePort: string;
  targetPort: string;
} {
  const sourcePort = sourceNode.type === "decision" ? "yes" : "output";
  const targetPort = "input";

  return { sourcePort, targetPort };
}

/**
 * Create auto-connection between two nodes
 * Returns updated target node with parentNode set and new edge
 * Reuses logic from onConnect
 *
 * @param sourceNode - Source node (existing node)
 * @param targetNode - Target node (newly dropped node)
 * @returns Updated target node and new edge
 */
export function createAutoConnection(
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
): {
  updatedTarget: WorkflowNode;
  newEdge: WorkflowEdge;
} {
  const { sourcePort, targetPort } = getAutoConnectPorts(sourceNode);

  // Update target node with parentNode and relative position
  const updatedTarget: WorkflowNode = {
    ...targetNode,
    parentNode: sourceNode.id,
    position: calculateRelativePosition(
      targetNode.position,
      sourceNode.positionAbsolute || sourceNode.position,
    ),
  };

  // Create edge
  const newEdge: WorkflowEdge = {
    id: generateEdgeId(sourceNode.id, targetNode.id),
    type: "workflow",
    source: sourceNode.id,
    target: targetNode.id,
    sourcePort,
    targetPort,
    markerEnd: {
      type: MarkerType.Arrow,
      color: PALETTE["neutral"].color,
    },
    data: {
      edgeType: "default",
      animated: false,
    },
  };

  return { updatedTarget, newEdge };
}

/**
 * Validate multiple nodes for group insertion
 * Filters out nodes that cannot be inserted into the target group
 *
 * @param draggingNodes - Array of nodes being dropped
 * @param targetGroup - Group node to insert into
 * @param allNodes - All nodes in the workflow
 * @returns Array of valid nodes that can be inserted
 */
export function filterValidNodesForGroup(
  draggingNodes: WorkflowNode[],
  targetGroup: WorkflowNode,
  allNodes: WorkflowNode[],
): WorkflowNode[] {
  return draggingNodes.filter((node) => {
    const validation = canInsertIntoGroup(node, targetGroup, allNodes);
    return validation.valid;
  });
}
