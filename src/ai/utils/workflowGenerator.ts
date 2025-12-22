/**
 * Workflow generator utilities
 *
 * Handles validation, mapping, and transformation of AI-generated
 * workflows into WorkflowNode and WorkflowEdge structures.
 */

import type {
  GeneratedWorkflow,
  GeneratedNode,
  ValidationResult,
} from "@/types/aiGenerate";
import type { WorkflowNode, WorkflowEdge } from "@/types";

import { generateNodeId, getDefaultPorts } from "@/utils/nodes";
import { generateDefaultEdge } from "@/utils/edges";

/**
 * Validate AI-generated workflow structure
 *
 * Checks for required nodes, valid edges, and correct node types
 *
 * @param workflow - Generated workflow to validate
 * @returns Validation result with errors and warnings
 */
export function validateGeneratedWorkflow(
  workflow: GeneratedWorkflow
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check for start node
  const startNodes = workflow.nodes.filter((n) => n.type === "start");
  if (startNodes.length === 0) {
    errors.push("No start node found");
  } else if (startNodes.length > 1) {
    warnings.push("Multiple start nodes found, only one should exist");
  }

  // 2. Check for end nodes
  const endNodes = workflow.nodes.filter((n) => n.type === "end");
  if (endNodes.length === 0) {
    warnings.push("No end nodes found");
  }

  // 3. Validate edges
  workflow.edges.forEach((edge, i) => {
    if (edge.sourceIndex < 0 || edge.sourceIndex >= workflow.nodes.length) {
      errors.push(`Edge ${i}: Invalid source index ${edge.sourceIndex}`);
    }
    if (edge.targetIndex < 0 || edge.targetIndex >= workflow.nodes.length) {
      errors.push(`Edge ${i}: Invalid target index ${edge.targetIndex}`);
    }

    // Check for self-loops
    if (edge.sourceIndex === edge.targetIndex) {
      errors.push(
        `Edge ${i}: Self-loop detected (node cannot connect to itself)`
      );
    }

    // Validate port names
    if (!edge.sourcePort || !edge.targetPort) {
      errors.push(`Edge ${i}: Missing port information`);
    }
  });

  // 4. Validate node types
  const validTypes = ["start", "end", "task", "decision", "service"];
  workflow.nodes.forEach((node, i) => {
    if (!validTypes.includes(node.type)) {
      errors.push(`Node ${i}: Invalid type "${node.type}"`);
    }

    // Validate required fields
    if (!node.title || node.title.trim() === "") {
      errors.push(`Node ${i}: Missing title`);
    }

    // Validate type-specific requirements
    if (
      node.type === "end" &&
      node.status &&
      !["success", "failure", "neutral"].includes(node.status)
    ) {
      errors.push(`Node ${i}: Invalid end node status "${node.status}"`);
    }

    if (
      node.type === "service" &&
      node.serviceType &&
      !["api", "database", "email", "webhook", "custom"].includes(
        node.serviceType
      )
    ) {
      warnings.push(`Node ${i}: Unknown service type "${node.serviceType}"`);
    }
  });

  // 5. Check for isolated nodes (no incoming or outgoing edges)
  const nodesWithEdges = new Set<number>();
  workflow.edges.forEach((edge) => {
    nodesWithEdges.add(edge.sourceIndex);
    nodesWithEdges.add(edge.targetIndex);
  });

  workflow.nodes.forEach((node, i) => {
    if (!nodesWithEdges.has(i) && workflow.nodes.length > 1) {
      // Start nodes with no outgoing edges
      if (node.type === "start") {
        errors.push(
          `Node ${i} (${node.title}): Start node must have at least one outgoing edge`
        );
      }
      // Other isolated nodes
      else if (node.type !== "end") {
        errors.push(
          `Node ${i} (${node.title}): Node must be connected to at least one other node`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get default ports for node type
 */

/**
 * Map generated node to WorkflowNode
 */
function mapGeneratedNode(node: GeneratedNode, index: number): WorkflowNode {
  const nodeId = generateNodeId(index, node.type);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseData: any = {
    title: node.title,
    description: node.description,
    ports: getDefaultPorts(node.type),
  };

  // Add type-specific fields
  if (node.type === "end" && node.status) {
    baseData.status = node.status;
  }

  if (node.type === "decision" && node.condition) {
    baseData.condition = node.condition;
    baseData.mode = "panel";
  }

  if (node.type === "service") {
    baseData.serviceType = node.serviceType || "api";
    baseData.mode = "panel";
    if (node.http) {
      baseData.http = node.http;
    }
  }

  if (node.type === "task" && node.assignee) {
    baseData.assignee = node.assignee;
  }

  return {
    id: nodeId,
    type: node.type,
    position: node.position,
    data: baseData,
  };
}

/**
 * Map GeneratedWorkflow to WorkflowNode and WorkflowEdge arrays
 *
 * @param generated - Validated generated workflow
 * @returns Object with nodes and edges arrays
 */
export function mapGeneratedToWorkflow(generated: GeneratedWorkflow): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  // Map nodes first to get IDs
  const nodes = generated.nodes.map((node, index) =>
    mapGeneratedNode(node, index)
  );

  // Create ID mapping
  const indexToId = new Map<number, string>(
    nodes.map((node, index) => [index, node.id])
  );

  // Map edges using node IDs
  const edges: WorkflowEdge[] = generated.edges.map((edge) => {
    const sourceId = indexToId.get(edge.sourceIndex);
    const targetId = indexToId.get(edge.targetIndex);

    if (!sourceId || !targetId) {
      throw new Error(
        `Invalid edge: source ${edge.sourceIndex} or target ${edge.targetIndex} not found`
      );
    }

    return {
      ...generateDefaultEdge(sourceId, targetId),
      source: sourceId,
      target: targetId,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,

      data: {
        edgeType: "default",
        animated: false,
      },
    };
  });

  return { nodes, edges };
}

/**
 * Establish parent-child relationships for nodes
 *
 * Sets the parentNode property based on edge connections.
 * This is required for the WorkflowExecutor to properly traverse
 * the workflow during execution.
 *
 * @param nodes - Array of workflow nodes
 * @param edges - Array of workflow edges
 * @returns Nodes with parent relationships established
 */
export function establishParentRelationships(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  // Create a map of target -> source relationships
  const parentMap = new Map<string, string>();

  edges.forEach((edge) => {
    // Set parent relationship: target node's parent is the source node
    // Note: If a node has multiple incoming edges, the last one wins
    // This is intentional for AI-generated workflows
    parentMap.set(edge.target, edge.source);
  });

  // Apply parent relationships to nodes
  return nodes.map((node) => {
    const parentId = parentMap.get(node.id);

    // Don't set parentNode for nodes without incoming edges (start nodes)
    if (!parentId) {
      return node;
    }

    return {
      ...node,
      parentNode: parentId,
    };
  });
}

/**
 * Layout configuration constants
 */
const LAYOUT_CONFIG = {
  NODE_SPACING_X: 300, // Horizontal spacing between nodes in same layer
  NODE_SPACING_Y: 180, // Vertical spacing between layers
  START_OFFSET_X: 100, // Initial X offset
  START_OFFSET_Y: 100, // Initial Y offset
  BRANCH_OFFSET: 250, // Additional offset for decision branches
};

/**
 * Build adjacency list from nodes and edges
 */
function buildAdjacencyList(
  nodeCount: number,
  edges: { sourceIndex: number; targetIndex: number }[]
): Map<number, number[]> {
  const adjList = new Map<number, number[]>();

  // Initialize all nodes
  for (let i = 0; i < nodeCount; i++) {
    adjList.set(i, []);
  }

  // Add edges
  edges.forEach((edge) => {
    const children = adjList.get(edge.sourceIndex) || [];
    children.push(edge.targetIndex);
    adjList.set(edge.sourceIndex, children);
  });

  return adjList;
}

/**
 * Calculate node depths using BFS from start node
 */
function calculateDepths(
  nodeCount: number,
  adjList: Map<number, number[]>,
  startIndex: number
): number[] {
  const depths = new Array(nodeCount).fill(-1);
  const queue: number[] = [startIndex];
  depths[startIndex] = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = adjList.get(current) || [];

    children.forEach((child) => {
      if (depths[child] === -1) {
        depths[child] = depths[current] + 1;
        queue.push(child);
      }
    });
  }

  return depths;
}

/**
 * Group nodes by their depth layer
 */
function groupByLayer(
  nodeCount: number,
  depths: number[]
): Map<number, number[]> {
  const layers = new Map<number, number[]>();

  for (let i = 0; i < nodeCount; i++) {
    const depth = depths[i];
    if (depth === -1) continue; // Skip unreachable nodes

    if (!layers.has(depth)) {
      layers.set(depth, []);
    }
    layers.get(depth)!.push(i);
  }

  return layers;
}

/**
 * Calculate positions for generated nodes using BFS-based layering
 */
function calculateNodePositions(
  nodes: GeneratedNode[],
  edges: { sourceIndex: number; targetIndex: number }[]
): GeneratedNode[] {
  if (nodes.length === 0) return nodes;

  // Find start node index
  const startIndex = nodes.findIndex((node) => node.type === "start");
  if (startIndex === -1) {
    throw new Error("No start node found in workflow");
  }

  // Build graph structure
  const adjList = buildAdjacencyList(nodes.length, edges);

  // Calculate depths using BFS
  const depths = calculateDepths(nodes.length, adjList, startIndex);

  // Group nodes by layer
  const layers = groupByLayer(nodes.length, depths);

  // Assign positions
  return nodes.map((node, idx) => {
    const layer = depths[idx];

    // Handle unreachable nodes (shouldn't happen with valid workflows)
    if (layer === -1) {
      return {
        ...node,
        position: { x: 0, y: 0 },
      };
    }

    const layerNodes = layers.get(layer) || [];
    const posInLayer = layerNodes.indexOf(idx);
    const layerWidth = layerNodes.length;

    // Center nodes horizontally within their layer
    const centerOffset = -((layerWidth - 1) * LAYOUT_CONFIG.NODE_SPACING_X) / 2;
    const x =
      LAYOUT_CONFIG.START_OFFSET_X +
      centerOffset +
      posInLayer * LAYOUT_CONFIG.NODE_SPACING_X;
    const y =
      LAYOUT_CONFIG.START_OFFSET_Y + layer * LAYOUT_CONFIG.NODE_SPACING_Y;

    return {
      ...node,
      position: { x, y },
    };
  });
}

/**
 * Calculate base position to avoid overlapping with existing nodes
 */
function calculateBasePosition(existingNodes: WorkflowNode[]): {
  x: number;
  y: number;
} {
  if (existingNodes.length === 0) {
    return { x: LAYOUT_CONFIG.START_OFFSET_X, y: LAYOUT_CONFIG.START_OFFSET_Y };
  }

  // Find rightmost node
  const maxX = Math.max(...existingNodes.map((n) => n.position.x));

  // Place new workflow 400px to the right
  return { x: maxX + 400, y: LAYOUT_CONFIG.START_OFFSET_Y };
}

/**
 * Apply base position offset to all node positions
 */
function applyBasePosition(
  nodes: GeneratedNode[],
  basePosition: { x: number; y: number }
): GeneratedNode[] {
  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + basePosition.x,
      y: node.position.y + basePosition.y,
    },
  }));
}

/**
 * Complete workflow generation pipeline
 *
 * Validates, maps, and prepares AI-generated workflow for canvas
 *
 * @param generated - Generated workflow from OpenAI
 * @param existingNodes - Existing nodes on canvas (for positioning)
 * @returns Ready-to-use nodes and edges
 * @throws Error if validation fails
 */
export function processGeneratedWorkflow(
  generated: GeneratedWorkflow,
  existingNodes: WorkflowNode[]
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  // 1. Calculate positions (relative)
  const positionedNodes = calculateNodePositions(
    generated.nodes,
    generated.edges
  );

  // 2. Calculate base position to avoid existing nodes
  const basePosition = calculateBasePosition(existingNodes);

  // 3. Apply base position offset
  const absoluteNodes = applyBasePosition(positionedNodes, basePosition);

  // 4. Create workflow with positioned nodes
  const workflowWithPositions = {
    ...generated,
    nodes: absoluteNodes,
  };

  // 5. Validate
  const validation = validateGeneratedWorkflow(workflowWithPositions);
  if (!validation.valid) {
    throw new Error(`Invalid workflow: ${validation.errors.join(", ")}`);
  }

  // Log warnings if any
  if (validation.warnings && validation.warnings.length > 0) {
    console.warn("Workflow warnings:", validation.warnings);
  }

  // 6. Map to workflow types
  const { nodes, edges } = mapGeneratedToWorkflow(workflowWithPositions);

  // 7. Establish relationships
  const finalNodes = establishParentRelationships(nodes, edges);

  return { nodes: finalNodes, edges };
}
