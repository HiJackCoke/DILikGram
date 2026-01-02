import { useCallback, useEffect, useRef } from "react";
import ReactDiagram, {
  useNodesState,
  useEdgesState,
  useStore,
  addEdge,
  updateEdge,
  type Connection,
  type Node,
} from "react-cosmos-diagram";
import "react-cosmos-diagram/dist/style.css";

import { nodeTypes } from "@/components/Nodes";
import { edgeTypes } from "@/components/Edges";

import { findFlowPath, hasSelectedNode } from "@/utils/flowHighlight";
import Sidebar from "@/components/Sidebar";
import type { WorkflowEdge } from "@/types/edges";
import type { ExecutionConfig } from "@/types/workflow";

import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";
import { UNIFIED_NODE_TEMPLATES } from "@/fixtures/nodes";
import { useExecutorOnSave } from "@/hooks/useExecutorOnSave";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";
import { useWorkflowGeneratorOnGenerate } from "@/hooks/useWorkflowGeneratorOnGenerate";
import { useExecutionSummary } from "@/contexts/ExecutionSummary";
import { useAIWorkflowEditor } from "@/contexts/AIWorkflowEditor";
import AIEditPanel from "@/components/AIEditPanel";

import ExecutionHeader from "./Header";

import { generateNodeId } from "@/utils/nodes";
import { generateDefaultEdge } from "@/utils/edges";
import { useWorkflowExecution } from "@/contexts/WorkflowExecution";

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
  const edgeUpdateSuccessful = useRef(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<
    WorkflowNode["data"],
    WorkflowNodeType
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { executeFromStartNode, isExecuting } = useWorkflowExecution();
  const { open: openPropertiesPanel, updateEdges } = usePropertiesPanel({
    onSave: handlePropertiesSave,
    onDelete: handleDeleteNode,
  });
  const { open: openExecutionSummary } = useExecutionSummary();
  const {
    state: aiEditState,
    isEditing,
    error: aiEditError,
    open: openAIEdit,
    close: closeAIEdit,
    setCurrentWorkflow,
    handleEdit,
  } = useAIWorkflowEditor();

  useExecutorOnSave(handleExecutorSave);
  useWorkflowGeneratorOnGenerate(handleWorkflowGenerator);

  const resetSelectedElements = useStore(
    (store) => store.resetSelectedElements
  );

  // WorkflowGenerator integration
  const { setExistingNodes } = useWorkflowGenerator();

  // Update existing nodes for positioning calculations
  useEffect(() => {
    setExistingNodes(nodes);
  }, [nodes, setExistingNodes]);

  useEffect(() => {
    updateEdges(edges);
  }, [edges]);

  // Update AIWorkflowEditor with current workflow state
  useEffect(() => {
    setCurrentWorkflow(nodes, edges);
  }, [nodes, edges, setCurrentWorkflow]);

  const onConnect = (params: Connection) => {
    const hasParent = edges.some((edge) => edge.target === params.target);

    if (hasParent) return window.alert("A node can have only one parent node.");

    setNodes((prevNodes) => {
      const { source, target } = params;
      if (!source || !target) return prevNodes;

      const sourceNode = nodes.find((node) => node.id === source);
      if (!sourceNode) return prevNodes;

      return prevNodes.map((node) => {
        if (!sourceNode.positionAbsolute) return node;

        return node.id === target
          ? {
              ...node,
              parentNode: source,
              position: {
                x: node.position.x - sourceNode.positionAbsolute.x,
                y: node.position.y - sourceNode.positionAbsolute.y,
              },
            }
          : node;
      });
    });

    setEdges((eds) => {
      const { source, target } = params;
      if (!source || !target) return eds;

      return addEdge(
        {
          ...params,
          ...generateDefaultEdge(source, target),
        },
        eds
      );
    });
  };

  const handleOpenPropertiesPanel = useCallback(
    (_: unknown, node: Node) => {
      openPropertiesPanel(node as WorkflowNode);
    },
    [openPropertiesPanel]
  );

  const handleNodeClick = (_: unknown, node: Node) => {
    // Handle START node - execute workflow
    if (node.type === "start") {
      if (isExecuting) return;
      executeFromStartNode(node.id);
      return;
    }

    // Handle END node - show execution summary modal
    if (node.type === "end") {
      const endNode = node as WorkflowNode;
      const summary = endNode.data?.execution?.summary;

      if (summary) {
        openExecutionSummary(summary);
      }
    }
  };

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();

      // Don't allow editing START and END nodes
      if (node.type === "start" || node.type === "end") {
        return;
      }

      // Open AI edit panel at cursor position
      openAIEdit(node.id, { x: event.clientX, y: event.clientY });
    },
    [openAIEdit]
  );

  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false;
  }, []);

  const onEdgeUpdate = useCallback(
    (originEdge: WorkflowEdge, newConnection: Connection) => {
      edgeUpdateSuccessful.current = true;

      setEdges((els) => updateEdge(originEdge, newConnection, els));
    },
    [setEdges]
  );

  const onEdgeUpdateEnd = useCallback(
    (_c: unknown, edge: WorkflowEdge) => {
      if (!edgeUpdateSuccessful.current) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === edge.target) {
              return {
                ...node,
                parentNode: undefined,
                position: node.positionAbsolute || node.position,
              };
            }
            return node;
          })
        );
      }

      edgeUpdateSuccessful.current = true;
    },
    [setEdges, setNodes]
  );

  // DND 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
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

      // Zoom(scale)과 비율 기반 offset을 모두 고려한 정확한 position 계산
      const position = {
        x: (e.clientX - offsetX - translate.x) / translate.scale,
        y: (e.clientY - offsetY - translate.y) / translate.scale,
      };

      // Create new node from template
      const template = UNIFIED_NODE_TEMPLATES[type]?.template;
      if (!template) return;

      const newNode: WorkflowNode = {
        id: generateNodeId(nodes.length, type),
        ...template,
        position,
      };

      setNodes((prevNodes) => [...prevNodes, newNode]);
    },
    [nodes.length, setNodes]
  );

  function handleWorkflowGenerator(
    newNodes: WorkflowNode[],
    newEdges: WorkflowEdge[]
  ) {
    setNodes((prev) => [...prev, ...newNodes]);
    setEdges((prev) => [...prev, ...newEdges]);
  }

  // Handle execution config save
  function handleExecutorSave(nodeId: string, config: ExecutionConfig) {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === nodeId) {
          const nodeData = node.data;
          return {
            ...node,
            data: {
              ...node.data,
              execution: {
                ...nodeData.execution,
                config,
              },
            },
          };
        }
        return node;
      })
    );
  }

  // Handle properties save
  function handlePropertiesSave(
    nodeId: string,
    data: Partial<WorkflowNode["data"]>
  ) {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
  }

  // Handle node delete
  function handleDeleteNode(nodeId: string) {
    setNodes((prevNodes) =>
      prevNodes
        .filter((n) => n.id !== nodeId)
        .map((node) =>
          node.parentNode === nodeId
            ? {
                ...node,
                parentNode: undefined,
                position: node.positionAbsolute || node.position,
              }
            : node
        )
    );

    setEdges((prevEdges) =>
      prevEdges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );

    resetSelectedElements();
  }

  // 선택된 노드의 플로우 경로 계산
  const { highlightedNodeIds, highlightedEdgeIds } = findFlowPath(nodes, edges);

  // 노드에 하이라이트 상태 추가 (execution.state는 handleNodeUpdate에서 관리)
  const enhancedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      state: {
        highlighted: highlightedNodeIds.has(node.id),
        dimmed: hasSelectedNode(nodes) && !highlightedNodeIds.has(node.id),
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
          hasSelectedNode(nodes) && !isHighlighted
            ? 0.2
            : edge.data?.animated
              ? 1
              : edge.style?.opacity || 1,
        strokeWidth: edge.data?.animated ? 3 : 2,
      },
    };
  });

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar />

      <ExecutionHeader nodes={nodes} setNodes={setNodes} setEdges={setEdges} />

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
        onNodeDoubleClick={handleOpenPropertiesPanel}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={resetSelectedElements}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onConnect={onConnect}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
      />

      <AIEditPanel
        open={aiEditState.isOpen}
        position={aiEditState.nodePosition}
        nodeId={aiEditState.nodeId}
        isEditing={isEditing}
        error={aiEditError}
        onSubmit={handleEdit}
        onClose={closeAIEdit}
      />
    </div>
  );
}
