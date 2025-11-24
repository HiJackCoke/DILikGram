import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

/**
 * 선택된 노드들의 전체 플로우 경로를 찾는 함수
 * nodes에서 selected === true인 노드들을 자동으로 찾음
 */
export function findFlowPath(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): {
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
} {
  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();

  // selected된 노드들 찾기
  const selectedNodes = nodes.filter((node) => node.selected);

  if (selectedNodes.length === 0) {
    return { highlightedNodeIds, highlightedEdgeIds };
  }

  // 선택된 각 노드에 대해 플로우 경로 찾기
  selectedNodes.forEach((selectedNode) => {
    highlightedNodeIds.add(selectedNode.id);

    // 1. 상위 노드들 찾기 (조상 노드들)
    const ancestors = findAncestors(selectedNode.id, nodes);
    ancestors.forEach((id) => highlightedNodeIds.add(id));

    // 2. 하위 노드들 찾기 (자손 노드들)
    const descendants = findDescendants(selectedNode.id, nodes, edges);
    descendants.forEach((id) => highlightedNodeIds.add(id));
  });

  // 3. 해당 노드들과 연결된 엣지 찾기
  edges.forEach((edge) => {
    if (
      highlightedNodeIds.has(edge.source) &&
      highlightedNodeIds.has(edge.target)
    ) {
      highlightedEdgeIds.add(edge.id);
    }
  });

  return { highlightedNodeIds, highlightedEdgeIds };
}

/**
 * 특정 노드의 조상 노드들을 재귀적으로 찾기
 */
function findAncestors(nodeId: string, nodes: WorkflowNode[]): string[] {
  const ancestors: string[] = [];
  const node = nodes.find((n) => n.id === nodeId);

  if (!node?.parentNode) return ancestors;

  ancestors.push(node.parentNode);
  // 재귀적으로 상위 노드의 부모도 찾기
  ancestors.push(...findAncestors(node.parentNode, nodes));

  return ancestors;
}

/**
 * 특정 노드의 자손 노드들을 찾기
 * 분기 처리: 선택된 노드가 분기의 시작점이면 모든 자식, 아니면 해당 경로만
 */
function findDescendants(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const descendants: string[] = [];
  const selectedNode = nodes.find((n) => n.id === nodeId);

  if (!selectedNode) return descendants;

  // 직접 자식 노드들 찾기
  const children = nodes.filter((n) => n.parentNode === nodeId);

  if (children.length === 0) return descendants;

  // Decision Node인 경우: 모든 분기의 자식 포함
  if (selectedNode.type === "decision") {
    children.forEach((child) => {
      descendants.push(child.id);
      // 재귀적으로 자손도 포함
      descendants.push(...findDescendants(child.id, nodes, edges));
    });
  } else {
    // 일반 노드인 경우: 부모-자식 관계만 따라감
    children.forEach((child) => {
      // 선택된 노드가 분기의 한 갈래에 있는 경우,
      // 같은 갈래의 자식만 포함
      const isInSameBranch = isNodeInSameBranch(nodeId, child.id, nodes, edges);

      if (isInSameBranch) {
        descendants.push(child.id);
        descendants.push(...findDescendants(child.id, nodes, edges));
      }
    });
  }

  return descendants;
}

/**
 * 두 노드가 같은 분기에 있는지 확인
 */
function isNodeInSameBranch(
  fromNodeId: string,
  toNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): boolean {
  // 직접 연결된 엣지가 있는지 확인
  const directEdge = edges.find(
    (edge) => edge.source === fromNodeId && edge.target === toNodeId
  );

  if (directEdge) return true;

  // 부모-자식 관계로 연결되어 있는지 확인
  const toNode = nodes.find((n) => n.id === toNodeId);
  if (toNode?.parentNode === fromNodeId) return true;

  return false;
}

/**
 * 특정 노드가 분기 노드(Decision)의 자식인지 확인
 */
export function isChildOfDecision(
  nodeId: string,
  nodes: WorkflowNode[]
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node?.parentNode) return false;

  const parent = nodes.find((n) => n.id === node.parentNode);
  return parent?.type === "decision";
}

/**
 * 선택된 노드가 있는지 확인
 */
export function hasSelectedNode(nodes: WorkflowNode[]): boolean {
  return nodes.some((node) => node.selected);
}
