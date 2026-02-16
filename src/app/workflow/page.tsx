"use client";

import {
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type TouchEvent,
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

import { type DragStartEvent } from "@dnd-kit/core";

import { nodeTypes } from "@/components/features/workflow/Nodes";
import { edgeTypes } from "@/components/features/workflow/Edges";

import { findFlowPath, hasSelectedNode } from "@/utils/graph/highlight";
import NodeTemplatePanel from "@/app/workflow/_components/NodeTemplatePanel";

import type { WorkflowEdge } from "@/types/edges";
import type { ExecutionConfig } from "@/types/workflow";

import type {
  WorkflowNode,
  WorkflowNodeType,
  GroupNodeData,
} from "@/types/nodes";

import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
import { useWorkflowGenerator } from "@/contexts/WorkflowGenerator";

import { useExecutionSummary } from "@/contexts/ExecutionSummary";
import { useAIWorkflowEditor } from "@/contexts/AIWorkflowEditor";
import { useGlobalKeyHandler } from "@/hooks/useGlobalKeyHandler";
import { useWorkflowVersioning } from "@/contexts/WorkflowVersioning";

import ExecutionHeader from "@/app/workflow/_layout/Header";

import {
  createDefaultNode,
  generateNodeId,
  setInternalNodesInGroupNode,
} from "@/utils/graph/nodes";

import {
  getNodesAtPosition,
  prioritizeIntersectedNodes,
} from "@/utils/graph/intersection";

import {
  canInsertIntoGroup,
  insertNodeIntoGroup,
  filterValidNodesForGroup,
  canAutoConnect,
  createAutoConnection,
  getNodeDimensions,
} from "@/utils/graph/nodeInsertion";

import { useWorkflowExecution } from "@/contexts/WorkflowExecution";
import { generateEdgeId, createDefaultEdge } from "@/utils/graph/edges";
import { PALETTE } from "@/constants/palette";
import { useLongPress } from "@/hooks/useLongPress";
import { useExecutorEditor } from "@/contexts/ExecutorEditor";
// import { initialNodes } from "@/mocks/nodes";
// import { initialEdges } from "@/mocks/edges";

export default function WorkflowPage() {
  const edgeUpdateSuccessful = useRef(true);
  const ref = useRef<HTMLDivElement>(null);

  const nodeTemplatePanelRectRef = useRef<DOMRect | null>(null);
  const distanceRef = useRef<XYPosition | null>(null);
  const [activeNodeType, setActiveNodeType] = useState<WorkflowNodeType | null>(
    null,
  );

  const transform = useStore((state) => state.transform);

  const { onTouchStart, onTouchMove, onTouchEnd } = useLongPress({
    onLongPress: handleLongPress,
  });
  const [nodes, setNodes, onNodesChange] = useNodesState<
    WorkflowNode["data"],
    WorkflowNodeType
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<WorkflowNode[]>([]);

  const { executeFromStartNode, isExecuting } = useWorkflowExecution();
  const { open: openPropertiesPanel, updateEdges } = usePropertiesPanel({
    onSave: handlePropertiesSave,
    onDelete: handleDeleteNode,
  });
  const { open: openExecutionSummary } = useExecutionSummary();
  const { save } = useWorkflowVersioning({
    onRestore: (nodes, edges) => {
      setNodes(nodes);
      setEdges(edges);
    },
  });
  const { open: openAIEdit, setCurrentWorkflow } = useAIWorkflowEditor({
    onEdit: (nodes, edges) => {
      setNodes(nodes);
      setEdges(edges);

      save(nodes, edges, {
        changeType: "edited",
        description: "Edited workflow via AI",
      });
    },
  });

  useExecutorEditor({
    onSave: handleExecutorSave,
    onInternalNodesChange: handleInternalNodesChange,
  });
  useWorkflowGenerator({ onGenerate: handleWorkflowGenerator });

  const resetSelectedElements = useStore(
    (store) => store.resetSelectedElements,
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

  // Register restore listener for version history
  // useEffect(() => {
  //   return registerOnRestore((nodes, edges) => {
  //     console.log(nodes, edges);
  //     setNodes(nodes);
  //     setEdges(edges);
  //   });
  // }, [registerOnRestore, setNodes, setEdges]);

  // Register keyboard shortcuts for copy/paste
  useGlobalKeyHandler({
    "Ctrl+C": handleCopyNodes,
    "Cmd+C": handleCopyNodes, // macOS
    "Ctrl+V": handlePasteNodes,
    "Cmd+V": handlePasteNodes, // macOS
  });

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
        eds,
      );
    });
  };

  const handleOpenPropertiesPanel = useCallback(
    (_: unknown, node: Node) => {
      openPropertiesPanel(node as WorkflowNode);
    },
    [openPropertiesPanel],
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
    [openAIEdit],
  );

  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false;
  }, []);

  const onEdgeUpdate = useCallback(
    (originEdge: WorkflowEdge, newConnection: Connection) => {
      edgeUpdateSuccessful.current = true;

      setEdges((els) => updateEdge(originEdge, newConnection, els));
    },
    [setEdges],
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
          }),
        );
      }

      edgeUpdateSuccessful.current = true;
    },
    [setEdges, setNodes],
  );

  // DND 핸들러
  // @dnd-kit drag handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent, distance: XYPosition) => {
      const item = event.activatorEvent.target as HTMLElement;
      const container = item.parentElement;

      if (!container) return;

      nodeTemplatePanelRectRef.current = container.getBoundingClientRect();

      distanceRef.current = distance;
      const { active } = event;

      setActiveNodeType(active.id.toString() as WorkflowNodeType);
    },
    [],
  );

  const generateNode = async ({ x, y }: XYPosition) => {
    if (!distanceRef.current) return;
    if (!activeNodeType) return;

    // NodeTemplatePanel 내부인지 체크
    const panelRect = nodeTemplatePanelRectRef.current;
    if (panelRect) {
      const isInsidePanel =
        x >= panelRect.left &&
        x <= panelRect.right &&
        y >= panelRect.top &&
        y <= panelRect.bottom;

      // NodeTemplatePanel 내부면 노드 생성하지 않음
      if (isInsidePanel) return;
    }

    const dimension = getNodeDimensions(activeNodeType);

    const position = {
      x:
        (x - dimension.width * distanceRef.current.x - transform[0]) /
        transform[2],
      y:
        (y - dimension.height * distanceRef.current.y - transform[1]) /
        transform[2],
    };

    // 🆕 Phase 1: 드롭 위치에 겹치는 노드 찾기
    const intersectedNodes = getNodesAtPosition(x, y, nodes, transform);
    const prioritizedNodes = prioritizeIntersectedNodes(intersectedNodes);

    // 🆕 그룹 노드 우선 체크
    const targetGroup = prioritizedNodes.find((node) => node.type === "group");

    const newNode = createDefaultNode({
      type: activeNodeType,
      position,
    });

    // 🆕 그룹에 삽입 시도
    if (targetGroup) {
      const validation = canInsertIntoGroup(newNode, targetGroup, nodes);

      if (validation.valid) {
        // 🆕 사용자 확인 받기
        const confirmed = await dialog.confirm(
          "Insert into Group?",
          `Do you want to insert this ${activeNodeType} node into the group?`,
        );

        if (confirmed) {
          // 그룹 내부에 삽입 (캔버스에 추가하지 않음)
          setNodes((prevNodes) =>
            insertNodeIntoGroup(prevNodes, newNode, targetGroup.id),
          );
          return;
        }
        // Cancel → 다음 옵션으로 계속 진행
      }
    }

    // 🆕 Phase 2: 그룹 삽입 실패 → 엣지 자동 연결 시도
    // 일반 노드 찾기 (task, service, decision)
    const targetNode = prioritizedNodes.find((node) =>
      ["task", "service", "decision"].includes(node.type || ""),
    );

    if (targetNode) {
      const validation = canAutoConnect(targetNode, newNode, edges);

      if (validation.valid) {
        // 🆕 사용자 확인 받기
        const confirmed = await dialog.confirm(
          "Auto-connect Nodes?",
          `Do you want to connect this ${activeNodeType} node to the ${targetNode.type} node?`,
        );

        if (confirmed) {
          const { updatedTarget, newEdge } = createAutoConnection(
            targetNode,
            newNode,
          );

          // 노드 추가 + 엣지 연결
          setNodes((prevNodes) => [...prevNodes, updatedTarget]);
          setEdges((prevEdges) => [...prevEdges, newEdge]);
          return;
        }
        // Cancel → fallback으로 진행
      }
    }

    // Fallback: 모든 자동화 실패 시 캔버스에 추가
    setNodes((prevNodes) => [...prevNodes, newNode]);
  };

  function handleWorkflowGenerator(
    newNodes: WorkflowNode[],
    newEdges: WorkflowEdge[],
  ) {
    const updatedNodes = [...nodes, ...newNodes];
    const updatedEdges = [...edges, ...newEdges];

    setNodes(updatedNodes);
    setEdges(updatedEdges);

    // Auto-save version after workflow generation
    save(updatedNodes, updatedEdges, {
      changeType: "generated",
      description: "Generated workflow from AI",
    });
  }

  // Handle execution config save
  function handleExecutorSave(
    nodeId: string,
    config: ExecutionConfig,
    internalNodes?: WorkflowNode[], // For group nodes
  ) {
    setNodes((prevNodes) => {
      const node = prevNodes.find((n) => n.id === nodeId);

      // Update node with new config (and internalNodes if group)
      const updatedNodes = prevNodes.map((n) => {
        if (n.id === nodeId) {
          const updates: WorkflowNode = {
            ...n,
            data: {
              ...n.data,
              execution: {
                ...n.data.execution,
                config,
              },
            },
          };

          // For group nodes: update groups array
          if (n.type === "group" && internalNodes !== undefined) {
            (updates.data as GroupNodeData).groups = internalNodes;
          }

          return updates;
        }
        return n;
      });

      // For group nodes: restore removed nodes to main canvas
      if (node?.type === "group" && internalNodes !== undefined) {
        const groupData = node.data as GroupNodeData;
        const removedNodeIds = new Set(
          (groupData.groups || []).map((n: WorkflowNode) => n.id),
        );
        const currentNodeIds = new Set(internalNodes.map((n) => n.id));
        const nodesToRestore = Array.from(removedNodeIds).filter(
          (id) => !currentNodeIds.has(id),
        );

        if (nodesToRestore.length > 0) {
          const restoredNodes = nodesToRestore.map((nodeId) => {
            const nodeToRestore = groupData.groups.find(
              (n: WorkflowNode) => n.id === nodeId,
            );
            return {
              ...nodeToRestore!,
              position: {
                x: (node.position.x || 0) + 300,
                y: node.position.y || 0,
              },
              parentNode: undefined,
            };
          });

          return [...updatedNodes, ...restoredNodes];
        }
      }

      return updatedNodes;
    });
  }

  // Handle internal nodes reordering/removal (auto-save)
  function handleInternalNodesChange(
    nodeId: string,
    internalNodes: WorkflowNode[],
  ) {
    setNodes(setInternalNodesInGroupNode(nodeId, internalNodes));
  }

  // Handle properties save
  function handlePropertiesSave(
    nodeId: string,
    data: Partial<WorkflowNode["data"]>,
  ) {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node,
      ),
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
            : node,
        ),
    );

    setEdges((prevEdges) =>
      prevEdges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    );

    resetSelectedElements();
  }

  // Handle copy nodes
  function handleCopyNodes() {
    const selectedNodes = nodes.filter((n) => n.selected);

    if (selectedNodes.length === 0) {
      console.log("No nodes selected to copy");
      return;
    }

    setClipboard(selectedNodes);
    console.log(`Copied ${selectedNodes.length} node(s)`);
  }

  // Handle paste nodes
  function handlePasteNodes() {
    if (clipboard.length === 0) {
      console.log("Clipboard is empty");
      return;
    }

    // Create ID mapping: old ID -> new ID
    const idMap = new Map<string, string>();

    const newNodes: WorkflowNode[] = clipboard.map((node) => {
      const newId = generateNodeId(node.type || "");
      idMap.set(node.id, newId);

      return createDefaultNode({
        ...node,
        id: newId,
        selected: false,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        data: {
          ...node.data,
          title: `${node.data.title} (복사본)`,
        },
      });
    });

    // Copy internal edges (edges between copied nodes)
    const copiedNodeIds = new Set(clipboard.map((n) => n.id));
    const edgesToCopy = edges.filter(
      (edge) =>
        copiedNodeIds.has(edge.source) && copiedNodeIds.has(edge.target),
    );

    const newEdges: WorkflowEdge[] = edgesToCopy.map((edge) =>
      createDefaultEdge({
        ...edge,
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
      }),
    );

    // Add to diagram
    setNodes((prev) => [...prev, ...newNodes]);
    setEdges((prev) => [...prev, ...newEdges]);

    console.log(
      `Pasted ${newNodes.length} node(s) and ${newEdges.length} edge(s)`,
    );
  }

  function handleLongPress(event: React.TouchEvent, node: Node) {
    const touch = event.touches?.[0];
    if (touch && node.id) {
      openAIEdit(node.id, { x: touch.clientX, y: touch.clientY });
    }
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

  const handleMouseUp: MouseEventHandler<HTMLDivElement> = async (e) => {
    await generateNode({ x: e.clientX, y: e.clientY });
    setActiveNodeType(null);
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = async (e) => {
    await generateNode({
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    });
    setActiveNodeType(null);
  };

  const handleOnNodeDragStart = (event: MouseEvent, node: Node) => {
    const toucheEvent = event as unknown as TouchEvent;
    if (toucheEvent.touches?.[0]) {
      onTouchStart(toucheEvent, node);
    }
  };

  const handleOnNodeDrag = (
    event: MouseEvent,
    _draggingNode: Node,
    _draggingNodes: Node[],
  ) => {
    const toucheEvent = event as unknown as TouchEvent;
    if (toucheEvent.touches?.[0]) {
      onTouchMove(toucheEvent);
    }
  };

  const handleOnNodeDragEnd = (
    _event: MouseEvent,
    _draggingNode: Node,
    draggingNodes: Node[],
  ) => {
    onTouchEnd();

    const typedNodes = draggingNodes as WorkflowNode[];
    const intersectedGroupNode = nodes.find(
      (node) => node.type === "group" && node.intersected,
    ) as WorkflowNode | undefined;

    if (!intersectedGroupNode) return;

    // 유틸 함수로 유효한 노드만 필터링
    const validNodes = filterValidNodesForGroup(
      typedNodes,
      intersectedGroupNode,
      nodes,
    );

    if (validNodes.length === 0) return;

    setNodes((prevNodes) => {
      // 그룹에 추가
      let updatedNodes = prevNodes;
      validNodes.forEach((nodeToInsert) => {
        updatedNodes = insertNodeIntoGroup(
          updatedNodes,
          nodeToInsert,
          intersectedGroupNode.id,
        );
      });

      // 캔버스에서 제거
      return updatedNodes.filter(
        (node) => !validNodes.some((n) => n.id === node.id),
      );
    });
  };

  return (
    <div
      ref={ref}
      className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      <NodeTemplatePanel onDragStart={handleDragStart} />

      <ReactDiagram
        dragSelectionKeyCode={null}
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
        onNodeDragStart={handleOnNodeDragStart}
        onNodeDrag={handleOnNodeDrag}
        onNodeDragEnd={handleOnNodeDragEnd}
        onPaneClick={resetSelectedElements}
        onConnect={onConnect}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
      >
        <ExecutionHeader
          nodes={nodes}
          setNodes={setNodes}
          setEdges={setEdges}
        />
      </ReactDiagram>
    </div>
  );
}
