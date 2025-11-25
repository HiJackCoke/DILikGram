import { useState, useRef } from "react";
import ReactDiagram, {
  useNodesState,
  useEdgesState,
  useStore,
} from "react-cosmos-diagram";
import "react-cosmos-diagram/dist/style.css";
import { Square, CheckCircle, XCircle } from "lucide-react";

import { nodeTypes } from "@/components/Nodes";
import { edgeTypes } from "@/components/Edges";
import { initialNodes } from "@/fixtures/nodes";
import { initialEdges } from "@/fixtures/edges";
import { findFlowPath, hasSelectedNode } from "@/utils/flowHighlight";
import {
  createWorkflowExecutor,
  type ExecutionState,
  type ExecutionMode,
} from "@/utils/workflowExecution";

export default function WorkflowPage() {
  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    currentNodeId: null,
    executedNodeIds: new Set(),
    activeEdgeIds: new Set(),
    isRunning: false,
    context: {
      outputs: new Map(),
      errors: new Map(),
      startTime: 0,
    },
  });

  const executorRef = useRef<ReturnType<typeof createWorkflowExecutor> | null>(
    null
  );

  const resetSelectedElements = useStore(
    (store) => store.resetSelectedElements
  );

  // 선택된 노드 확인

  // 선택된 노드 ID 추출
  const selectedNodeId = nodes.find((node) => node.selected)?.id;

  // 선택된 노드의 플로우 경로 계산
  const { highlightedNodeIds, highlightedEdgeIds } = findFlowPath(nodes, edges);
  // 워크플로우 실행
  const executeWorkflow = (mode: ExecutionMode) => {
    if (executionState.isRunning) return;

    // 기존 실행 상태 초기화
    setExecutionState({
      currentNodeId: null,
      executedNodeIds: new Set(),
      activeEdgeIds: new Set(),
      isRunning: false,
      context: {
        outputs: new Map(),
        errors: new Map(),
        startTime: 0,
      },
    });

    // Executor 생성 및 실행
    executorRef.current = createWorkflowExecutor(
      nodes,
      edges,
      mode,
      (state) => {
        setExecutionState(state);
      }
    );

    executorRef.current.execute();
  };
  // 실행 중단
  const stopExecution = () => {
    executorRef.current?.abort();
    setExecutionState({
      currentNodeId: null,
      executedNodeIds: new Set(),
      activeEdgeIds: new Set(),
      isRunning: false,
      context: {
        outputs: new Map(),
        errors: new Map(),
        startTime: 0,
      },
    });
  };

  // 노드에 하이라이트 + 실행 상태 추가
  const enhancedNodes = nodes.map((node) => {
    let executionNodeState: "idle" | "executing" | "executed" = "idle";

    if (executionState.currentNodeId === node.id) {
      executionNodeState = "executing";
    } else if (executionState.executedNodeIds.has(node.id)) {
      executionNodeState = "executed";
    }

    return {
      ...node,
      data: {
        ...node.data,
        highlighted: highlightedNodeIds.has(node.id),
        dimmed: hasSelectedNode(nodes) && !highlightedNodeIds.has(node.id),
        executionState: executionNodeState,
      },
    };
  });

  // 엣지에 애니메이션 상태 추가
  const enhancedEdges = edges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);
    const isExecuting = executionState.activeEdgeIds.has(edge.id);

    return {
      ...edge,
      data: {
        ...edge.data,
        animated: isHighlighted || isExecuting,
      },
      style: {
        ...edge.style,
        opacity:
          hasSelectedNode(nodes) && !isHighlighted
            ? 0.2
            : isExecuting
              ? 1
              : edge.style?.opacity || 1,
        strokeWidth: isExecuting ? 3 : 2,
      },
    };
  });

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="absolute top-4 left-4 z-10 space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Workflow Builder
          </h1>
          <p className="text-slate-400 text-sm">react-cosmos-diagram</p>
        </div>

        {/* Execution Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => executeWorkflow("success")}
            disabled={executionState.isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            성공 실행
          </button>
          <button
            onClick={() => executeWorkflow("failure")}
            disabled={executionState.isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
          >
            <XCircle className="w-4 h-4" />
            실패 실행
          </button>
          {executionState.isRunning && (
            <button
              onClick={stopExecution}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <Square className="w-4 h-4" />
              중단
            </button>
          )}
        </div>

        {/* Status */}
        {executionState.isRunning && executionState.currentNodeId && (
          <div className="px-3 py-1.5 bg-blue-600/90 text-white rounded-lg text-sm">
            실행 중:{" "}
            <span className="font-semibold">
              {executionState.currentNodeId}
            </span>
          </div>
        )}

        {selectedNodeId && !executionState.isRunning && (
          <div className="px-3 py-1.5 bg-purple-600/90 text-white rounded-lg text-sm">
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
            <span className="text-slate-400 text-xs">Default</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-success-bg rounded" />
            <span className="text-slate-400 text-xs">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-danger-bg rounded" />
            <span className="text-slate-400 text-xs">Error</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-palette-warning-bg rounded" />
            <span className="text-slate-400 text-xs">Warning</span>
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
