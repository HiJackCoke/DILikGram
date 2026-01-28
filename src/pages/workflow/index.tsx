import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type TouchEventHandler,
} from "react";
import ReactDiagram, {
  useNodesState,
  useEdgesState,
  useStore,
  addEdge,
  updateEdge,
  type Connection,
  type Node,
  MarkerType,
  type XYPosition,
} from "react-cosmos-diagram";
import "react-cosmos-diagram/dist/style.css";

import { type DragStartEvent } from "@dnd-kit/core";

import { nodeTypes } from "@/components/Nodes";
import { edgeTypes } from "@/components/Edges";

import { findFlowPath, hasSelectedNode } from "@/utils/flowHighlight";
import NodeTemplatePanel from "@/components/NodeTemplatePanel";

import type { WorkflowEdge } from "@/types/edges";
import type { ExecutionConfig } from "@/types/workflow";

import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";

import { useExecutorOnSave } from "@/hooks/useExecutorOnSave";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";
import { useWorkflowGeneratorOnGenerate } from "@/hooks/useWorkflowGeneratorOnGenerate";
import { useExecutionSummary } from "@/contexts/ExecutionSummary";
import { useAIWorkflowEditor } from "@/contexts/AIWorkflowEditor";

import ExecutionHeader from "./Header";

import { createDefaultNode } from "@/utils/nodes";

import { useWorkflowExecution } from "@/contexts/WorkflowExecution";
import { generateEdgeId } from "@/utils/edges";
import { PALETTE } from "../../../tailwind.config";
// import { initialNodes } from "@/mocks/nodes";
// import { initialEdges } from "@/mocks/edges";

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
  const ref = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState<XYPosition | null>(null);
  const [activeNodeType, setActiveNodeType] = useState<WorkflowNodeType | null>(
    null
  );
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
  const { open: openAIEdit, setCurrentWorkflow } = useAIWorkflowEditor({
    onEdit: (nodes, edges) => {
      setNodes(nodes);
      setEdges(edges);
    },
  });

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
          id: generateEdgeId(source, target),
          type: "workflow",
          markerEnd: {
            type: MarkerType.Arrow,
            color: PALETTE["neutral"].color,
          },
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
  // @dnd-kit drag handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent, distance: XYPosition) => {
      setDistance(distance);
      const { active } = event;

      setActiveNodeType(active.id.toString() as WorkflowNodeType);
    },
    []
  );

  const generateNode = ({ x, y }: XYPosition) => {
    if (!distance) return;
    if (!activeNodeType) return;

    const viewport = ref.current?.querySelector(
      ".react-diagram__viewport"
    ) as HTMLDivElement;

    const isIn = x < viewport.offsetWidth && y < viewport.offsetHeight;

    if (!isIn) return null;

    const dimension = getNodeDimensions(activeNodeType);
    const translate = getTranslateValues(viewport?.style.transform);
    const position = {
      x: (x - dimension.width * distance.x - translate.x) / translate.scale,
      y: (y - dimension.height * distance.y - translate.y) / translate.scale,
    };

    const newNode = createDefaultNode({
      type: activeNodeType,
      position,
    });

    setNodes((prevNodes) => [...prevNodes, newNode]);
  };

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

  const handleMouseUp: MouseEventHandler<HTMLDivElement> = (e) => {
    generateNode({ x: e.clientX, y: e.clientY });
    setActiveNodeType(null);
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (e) => {
    generateNode({
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    });
    setActiveNodeType(null);
  };

  return (
    <div
      ref={ref}
      className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      <NodeTemplatePanel
        onDragStart={handleDragStart}
        // onDragMove={(_, position) => {
        //   console.log(position);
        //   setDistance(position);
        // }}
        // onDragEnd={handleDragEnd}
      />

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
        onConnect={onConnect}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
      />
    </div>
  );
}
