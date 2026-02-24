import type { UpdateWorkflowResponse } from "@/types/ai";
import type { WorkflowNode, WorkflowEdge } from "@/types";
import {
  createDefaultNode,
  findAllDescendantNodes,
  findLeafNodes,
  generateNodeId,
} from "@/utils/graph/nodes";
import { createWorkflowEdge } from "@/utils/graph/edges";
import { calculateNodePositions } from "./layout";

export function sanitizeNewNodeIds(newNodes: WorkflowNode[]): WorkflowNode[] {
  const idMap = new Map<string, string>();
  const newNodeIds = new Set(newNodes.map((n) => n.id));

  const remapped = newNodes.map((node) => {
    const newId = generateNodeId(node.type ?? "task");
    idMap.set(node.id, newId);
    return { ...node, id: newId };
  });

  return remapped.map((node) => {
    const baseNode = {
      ...node,
      parentNode:
        node.parentNode && newNodeIds.has(node.parentNode)
          ? (idMap.get(node.parentNode) ?? node.parentNode)
          : node.parentNode,
    };

    // Add lastModified timestamp to execution.config if it exists
    if (baseNode.data?.execution?.config) {
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          execution: {
            ...baseNode.data.execution,
            config: {
              ...baseNode.data.execution.config!,
              lastModified: Date.now(),
            },
          },
        },
      };
    }

    return baseNode;
  });
}

export const createWorkflow = (
  nodes: WorkflowNode[],
  existingNodes: WorkflowNode[] = [],
) => {
  const edges: WorkflowEdge[] = [];
  const leafNodes = findLeafNodes(nodes);

  const startEdges: WorkflowEdge[] = [];
  const startNodes: WorkflowNode[] = [];

  const endEdges: WorkflowEdge[] = [];
  const endNodes = leafNodes
    .filter((node) => node.type !== "end")
    .map(({ id, position }) => {
      const createdEndNode = createDefaultNode({
        type: "end",
        parentNode: id,
        position: {
          x: position.x,
          y: position.y,
        },
      });

      endEdges.push(createWorkflowEdge(createdEndNode));
      return createdEndNode;
    });

  const addedParentNodes = nodes.map((node) => {
    const parentNodeId = node.parentNode;
    const parentNode = nodes.find((node) => node.id === parentNodeId);
    const isRootNode = !node.parentNode;

    if (isRootNode) {
      if (node.type === "start") return node;

      const startNode = createDefaultNode({
        type: "start",
      });

      const newNode = {
        ...node,
        parentNode: startNode.id,
        position: {
          x: node.position.x,
          y: node.position.y,
        },
      };

      const startEdge = createWorkflowEdge(newNode);

      startNodes.push(startNode);
      startEdges.push(startEdge);

      return newNode;
    }

    if (!parentNode) {
      console.warn(
        `[Defensive Check] Node ${node.id} has no parent node. ` +
          `This should have been fixed by validation pipeline. Skipping edge creation.`,
      );
      // Defensive: This should never happen after validation pipeline
      // Skip edge creation for this orphaned node
      return {
        ...node,
        position: {
          x: node.position.x,
          y: node.position.y,
        },
      };
    }

    if (parentNode?.type === "decision") {
      // Decision nodes must have branchLabel on child
      if (!node.data.branchLabel) {
        throw new Error(
          `Node at id ${node.id} has decision node parent but missing branchLabel. ` +
            `Must specify branchLabel: 'yes' | 'no'`,
        );
      }
    }

    const edge = createWorkflowEdge(node);

    edges.push(edge);

    return {
      ...node,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
    };
  });

  const workflowNodes = [...startNodes, ...addedParentNodes, ...endNodes];

  // Apply layout algorithm to calculate positions
  const positionedNodes = calculateNodePositions(workflowNodes);

  const workflowEdges = [...startEdges, ...edges, ...endEdges];

  return { nodes: positionedNodes, edges: workflowEdges };
};

export function mergeWorkflow(
  currentNodes: WorkflowNode[],
  editResult: UpdateWorkflowResponse,
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  let nodes = [...currentNodes];

  const deleteNodes = editResult.nodes?.delete ?? [];
  const updateNodes = editResult.nodes?.update ?? [];
  const createNodes = editResult.nodes?.create ?? [];

  if (deleteNodes.length > 0) {
    const deleteIds = new Set(deleteNodes);
    const nodesToDelete = findAllDescendantNodes(nodes, deleteIds);

    nodes = nodes.filter((node) => !nodesToDelete.has(node.id));
  }

  // Step 3: Update existing nodes
  if (updateNodes.length > 0) {
    updateNodes.forEach((updateOp) => {
      console.log("updateOp", updateOp);
      const nodeIndex = nodes.findIndex((n) => n.id === updateOp.id);
      if (nodeIndex >= 0) {
        const updatedData = {
          ...nodes[nodeIndex].data,
          ...updateOp.data,
        };

        // Add lastModified timestamp if execution.config is being updated
        if (updateOp.data?.execution?.config) {
          updatedData.execution = {
            ...updatedData.execution,
            config: {
              ...updatedData.execution!.config!,
              lastModified: Date.now(),
            },
          };
        }

        nodes[nodeIndex] = {
          ...nodes[nodeIndex],
          data: updatedData,
          parentNode: updateOp.parentNode || nodes[nodeIndex].parentNode,
        };
      }
    });
  }

  // Step 4: Create new nodes (with enrichment)
  if (createNodes.length > 0) {
    nodes = [...nodes, ...createNodes];
  }

  return createWorkflow(nodes, currentNodes);
}
