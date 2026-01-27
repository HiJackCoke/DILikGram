import type { UpdateWorkflowResponse } from "@/types/ai";
import type { WorkflowNode, WorkflowEdge } from "@/types";
import {
  createDefaultNode,
  findAllDescendantNodes,
  findLeafNodes,
} from "@/utils/nodes";
import { createWorkflowEdge } from "@/utils/edges";

export const createWorkflow = (nodes: WorkflowNode[]) => {
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
          y: 300,
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
          y: 300,
        },
      };

      const startEdge = createWorkflowEdge(newNode);

      startNodes.push(startNode);
      startEdges.push(startEdge);

      return newNode;
    }

    if (!parentNode) {
      throw new Error(
        `Node ${node.id} has no parent node. ` +
          `All nodes except the start node must have a parentNode.`
      );
    }

    if (parentNode?.type === "decision") {
      // Decision nodes must have branchLabel on child
      if (!node.data.branchLabel) {
        throw new Error(
          `Node at id ${node.id} has decision node parent but missing branchLabel. ` +
            `Must specify branchLabel: 'yes' | 'no'`
        );
      }
    }

    const edge = createWorkflowEdge(node);

    edges.push(edge);

    return {
      ...node,
      position: {
        x: node.position.x,
        y: 300,
      },
    };
  });

  const workflowNodes = [...startNodes, ...addedParentNodes, ...endNodes];
  const workflowEdges = [...startEdges, ...edges, ...endEdges];

  return { nodes: workflowNodes, edges: workflowEdges };
};

export function mergeWorkflow(
  currentNodes: WorkflowNode[],
  editResult: UpdateWorkflowResponse
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
        nodes[nodeIndex] = {
          ...nodes[nodeIndex],
          data: {
            ...nodes[nodeIndex].data,
            ...updateOp.data,
          },
          parentNode: updateOp.parentNode || nodes[nodeIndex].parentNode,
        };
      }
    });
  }

  // Step 4: Create new nodes (with enrichment)
  if (createNodes.length > 0) {
    nodes = [...nodes, ...createNodes];
  }

  return createWorkflow(nodes);
}
