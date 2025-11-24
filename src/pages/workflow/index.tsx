import { useMemo } from "react";
import ReactDiagram, {
  useNodesState,
  useEdgesState,
  useStore,
} from "react-cosmos-diagram";
import "react-cosmos-diagram/dist/style.css";

import { nodeTypes } from "@/components/Nodes";
import { edgeTypes } from "@/components/Edges";
import { initialNodes } from "@/fixtures/nodes";
import { initialEdges } from "@/fixtures/edges";
import { findFlowPath, hasSelectedNode } from "@/utils/flowHighlight";

export default function WorkflowPage() {
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const resetSelectedElements = useStore(
    (store) => store.resetSelectedElements
  );

  // 선택된 노드 확인 (nodes에서 selected === true)
  const isAnyNodeSelected = useMemo(() => hasSelectedNode(nodes), [nodes]);

  // 선택된 노드 ID 추출 (디버깅/표시용)
  const selectedNodeId = useMemo(() => {
    const selectedNode = nodes.find((node) => node.selected);
    return selectedNode?.id || null;
  }, [nodes]);

  // 선택된 노드의 플로우 경로 계산 (nodes에서 자동으로 selected 찾음)
  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    return findFlowPath(nodes, edges);
  }, [nodes, edges]);

  // 노드에 하이라이트 상태 추가
  const enhancedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        highlighted: highlightedNodeIds.has(node.id),
        dimmed: isAnyNodeSelected && !highlightedNodeIds.has(node.id),
      },
    }));
  }, [nodes, highlightedNodeIds, isAnyNodeSelected]);

  // 엣지에 애니메이션 상태 추가
  const enhancedEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        animated: highlightedEdgeIds.has(edge.id),
      },
      style: {
        ...edge.style,
        opacity:
          isAnyNodeSelected && !highlightedEdgeIds.has(edge.id) ? 0.2 : 1,
      },
    }));
  }, [edges, highlightedEdgeIds, isAnyNodeSelected]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-2xl font-bold text-white mb-2">Workflow Builder</h1>
        <p className="text-palette-neutral-color text-sm">
          react-cosmos-diagram
        </p>
        {selectedNodeId && (
          <div className="mt-2 px-3 py-1.5 bg-blue-600/90 text-white rounded-lg text-sm">
            선택된 노드: <span className="font-semibold">{selectedNodeId}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-slate-800/80 rounded-lg p-4 border border-slate-700">
        <p className="text-slate-300 text-xs font-semibold mb-2">Edge Types</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-neutral-bg rounded" />
            <span className="text-palette-neutral-color text-xs">Default</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-success-bg rounded" />
            <span className="text-palette-neutral-color text-xs">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-danger-bg rounded" />
            <span className="text-palette-neutral-color text-xs">Error</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-warning-bg rounded" />
            <span className="text-palette-neutral-color text-xs">Warning</span>
          </div>
        </div>
      </div>

      {/* Diagram */}
      <ReactDiagram
        nodes={enhancedNodes}
        edges={enhancedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionRadius={20}
        minZoom={0.5}
        maxZoom={2}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={resetSelectedElements}
      />
    </div>
  );
}
