import { useState, useRef, useCallback } from "react";
import ReactDiagram, {
  useNodesState,
  useEdgesState,
  useStore,
} from "react-cosmos-diagram";
import "react-cosmos-diagram/dist/style.css";
import { Square, CheckCircle, XCircle } from "lucide-react";

import { nodeTypes } from "@/components/Nodes";
import { edgeTypes } from "@/components/Edges";
import { initialNodes } from "@/mocks/nodes";
import { initialEdges } from "@/mocks/edges";

import { findFlowPath, hasSelectedNode } from "@/utils/flowHighlight";
import Sidebar from "@/components/Sidebar";
import {
  createWorkflowExecutor,
  type ExecutionState,
  type ExecutionMode,
} from "@/utils/workflowExecution";
import type { WorkflowEdge } from "@/types/edges";
import type {
  ExecutorResult,
  ExecutorState,
  ExecutorConfig,
} from "@/types/executor";
import { ExecutorEditorProvider } from "@/contexts/ExecutorEditorContext";
import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";
import { UNIFIED_NODE_TEMPLATES } from "@/fixtures/nodes";

// Viewport transform 값 추출 헬퍼 함수
function getTranslateValues(transformString: string) {
  const translateRegex = /translate\(\s*([^\s,]+)px\s*,\s*([^\s,]+)px\s*\)/;
  const scaleRegex = /scale\(\s*([^\s,]+)\s*(?:,\s*([^\s,]+))?\s*\)/;

  const matches = transformString.match(translateRegex);
  const scaleMatches = transformString.match(scaleRegex);

  let x = 0,
    y = 0,
    scale = 1;

  if (matches) {
    x = parseFloat(matches[1]);
    y = parseFloat(matches[2]);
  }

  if (scaleMatches) {
    scale = parseFloat(scaleMatches[1]);
  }

  return { x, y, scale };
}

// 노드 타입별 기본 크기 (실제 렌더링 크기와 동일)
function getNodeDimensions(type: string): { width: number; height: number } {
  const dimensions: Record<string, { width: number; height: number }> = {
    start: { width: 96, height: 96 }, // w-24 h-24
    end: { width: 96, height: 96 }, // w-24 h-24
    task: { width: 200, height: 120 }, // 평균 크기 (min-w-[200px] max-w-[280px])
    decision: { width: 144, height: 144 }, // w-36 h-36
    service: { width: 200, height: 120 }, // 평균 크기 (min-w-[200px] max-w-[280px])
  };

  return dimensions[type] || { width: 200, height: 100 }; // 기본값
}

export default function WorkflowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [executionState, setExecutionState] = useState<ExecutionState>({
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

  // 노드 업데이트 콜백
  const handleNodeUpdate = useCallback(
    (
      nodeId: string,
      executor: { result: ExecutorResult; state: ExecutorState }
    ) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  executor: {
                    ...node.data.executor,
                    ...executor,
                  },
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  // 엣지 업데이트 콜백
  const handleEdgeUpdate = useCallback(
    (edgeId: string, data: Partial<WorkflowEdge["data"]>) => {
      setEdges((prevEdges) =>
        prevEdges.map((edge) =>
          edge.id === edgeId
            ? { ...edge, data: { ...edge.data, ...data } }
            : edge
        )
      );
    },
    [setEdges]
  );

  // Handle executor config save
  const handleExecutorSave = useCallback(
    (nodeId: string, config: ExecutorConfig) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id === nodeId) {
            const nodeData = node.data;
            return {
              ...node,
              data: {
                ...node.data,
                executor: {
                  ...nodeData.executor,
                  config,
                },
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // DND 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const type = e.dataTransfer.getData(
      "application/nodeType"
    ) as WorkflowNodeType;
    if (!type) return;

    // JSON으로 저장된 비율 데이터 파싱
    const distance = JSON.parse(
      e.dataTransfer.getData("application/nodeDistance") || "{}"
    );
    const ratioX = distance.x || 0.5; // 기본값 중앙
    const ratioY = distance.y || 0.5; // 기본값 중앙

    // 실제 노드 크기 가져오기
    const nodeDimensions = getNodeDimensions(type);

    // Viewport 요소 쿼리 (.react-diagram__viewport)
    const container = e.currentTarget as HTMLDivElement;
    const viewport = container.querySelector(
      ".react-diagram__viewport"
    ) as HTMLDivElement;

    // Transform 값 추출 (translate + scale)
    const translate = getTranslateValues(viewport?.style.transform);

    // 비율 × 실제 노드 크기 = 픽셀 offset
    const offsetX = ratioX * nodeDimensions.width * translate.scale;
    const offsetY = ratioY * nodeDimensions.height * translate.scale;

    console.log(ratioY, nodeDimensions.height, translate.scale);

    // Zoom(scale)과 비율 기반 offset을 모두 고려한 정확한 position 계산
    const position = {
      x: (e.clientX - offsetX - translate.x) / translate.scale,
      y: (e.clientY - offsetY - translate.y) / translate.scale,
    };

    console.log(translate);
    // Create new node from template
    const template = UNIFIED_NODE_TEMPLATES[type]?.template;
    if (!template) return;

    const newNode: WorkflowNode = {
      id: `${type}-${Date.now()}`,
      ...template,
      position,
    };

    setNodes((prevNodes) => [...prevNodes, newNode]);
  };

  // 선택된 노드 ID 추출
  const selectedNodeId = nodes.find((node) => node.selected)?.id;

  // 선택된 노드의 플로우 경로 계산
  const { highlightedNodeIds, highlightedEdgeIds } = findFlowPath(
    nodes as WorkflowNode[],
    edges
  );
  // 워크플로우 실행
  const executeWorkflow = (mode: ExecutionMode) => {
    if (executionState.isRunning) return;

    // 기존 실행 상태 초기화
    setExecutionState({
      isRunning: false,
      context: {
        outputs: new Map(),
        errors: new Map(),
        startTime: 0,
      },
    });

    // Executor 생성 및 실행
    executorRef.current = createWorkflowExecutor(
      nodes as WorkflowNode[],
      edges,
      mode,
      (state) => {
        setExecutionState(state);
      },
      handleNodeUpdate,
      handleEdgeUpdate
    );

    executorRef.current.execute();
  };
  // 실행 중단
  const stopExecution = () => {
    executorRef.current?.abort();
    setExecutionState({
      isRunning: false,
      context: {
        outputs: new Map(),
        errors: new Map(),
        startTime: 0,
      },
    });
  };

  // 노드에 하이라이트 상태 추가 (executor.state는 handleNodeUpdate에서 관리)
  const enhancedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      state: {
        highlighted: highlightedNodeIds.has(node.id),
        dimmed:
          hasSelectedNode(nodes as WorkflowNode[]) &&
          !highlightedNodeIds.has(node.id),
      },
    },
  }));

  // 엣지에 애니메이션 상태 추가
  const enhancedEdges = edges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);

    return {
      ...edge,
      style: {
        ...edge.style,
        opacity:
          hasSelectedNode(nodes as WorkflowNode[]) && !isHighlighted
            ? 0.2
            : edge.data?.animated
              ? 1
              : edge.style?.opacity || 1,
        strokeWidth: edge.data?.animated ? 3 : 2,
      },
    };
  });

  return (
    <>
      <ExecutorEditorProvider
        nodes={nodes as WorkflowNode[]}
        onSave={handleExecutorSave}
      >
        <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          {/* Sidebar */}
          <Sidebar />

          {/* Header */}
          <div className="absolute top-4 left-20 z-10 space-y-3">
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
            {executionState.isRunning &&
              (() => {
                const currentNode = nodes.find(
                  (n) => n.data.executor?.state === "executing"
                );
                return currentNode ? (
                  <div className="px-3 py-1.5 bg-blue-600/90 text-white rounded-lg text-sm">
                    실행 중:{" "}
                    <span className="font-semibold">{currentNode.id}</span>
                  </div>
                ) : null;
              })()}

            {selectedNodeId && !executionState.isRunning && (
              <div className="px-3 py-1.5 bg-purple-600/90 text-white rounded-lg text-sm">
                선택된 노드:{" "}
                <span className="font-semibold">{selectedNodeId}</span>
              </div>
            )}

            {/* Execution Statistics */}
            {(() => {
              const executedCount = nodes.filter(
                (n) => n.data.executor?.state === "executed"
              ).length;
              return executedCount > 0 ? (
                <div className="px-3 py-2 bg-slate-800/90 border border-slate-700 text-white rounded-lg text-sm space-y-1">
                  <div className="font-semibold text-slate-300 mb-1.5">
                    실행 통계
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">완료된 노드:</span>
                    <span className="font-semibold text-palette-success-color">
                      {executedCount}
                    </span>
                  </div>
                  {executionState.context.errors.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">에러:</span>
                      <span className="font-semibold text-palette-danger-color">
                        {executionState.context.errors.size}
                      </span>
                    </div>
                  )}
                  {executionState.context.startTime > 0 &&
                    executionState.context.endTime && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">실행 시간:</span>
                        <span className="font-semibold text-palette-primary-color">
                          {(
                            (executionState.context.endTime -
                              executionState.context.startTime) /
                            1000
                          ).toFixed(2)}
                          s
                        </span>
                      </div>
                    )}
                </div>
              ) : null;
            })()}
          </div>

          {/* Legend */}
          <div className="absolute top-4 right-4 z-10 bg-slate-800/80 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-300 text-xs font-semibold mb-2">
              Edge Types
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-palette-neutral-bg rounded" />
                <span className="text-palette-neutral-color text-xs">
                  Default
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-palette-success-bg rounded" />
                <span className="text-palette-neutral-color text-xs">
                  Success
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-palette-danger-bg rounded" />
                <span className="text-palette-neutral-color text-xs">
                  Error
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-palette-warning-bg rounded" />
                <span className="text-palette-neutral-color text-xs">
                  Warning
                </span>
              </div>
            </div>
          </div>

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
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        </div>
      </ExecutorEditorProvider>
    </>
  );
}
