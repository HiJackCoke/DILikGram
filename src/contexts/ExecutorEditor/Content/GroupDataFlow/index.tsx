import { useBrowserEnv } from "@/hooks/useBrowserEnv";
import { ExecutionConfig, WorkflowNode } from "@/types";

import {
  closestCorners,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Fragment, useState } from "react";
import GroupDataFlowView from "./View";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
import { GroupDataFlowProps } from "./type";
import ExecutorEditorContent from "..";
import { flushSync } from "react-dom";

export default function GroupDataFlow({
  internalNodes = [],
  rootInputData,
  onReorder,
  onRemove,
  onInternalNodePropertiesSave,
  onInternalNodeConfigSave,
}: GroupDataFlowProps) {
  const { open } = usePropertiesPanel({ onSave: handlePropertiesSave });

  const hasMouseSupport = useBrowserEnv(({ window }) => {
    const hasPointerFine = window.matchMedia("(pointer: fine)").matches;

    const hasTouchSupport =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    return hasPointerFine && !hasTouchSupport;
  }, false);

  const DeviceSensor = hasMouseSupport ? PointerSensor : TouchSensor;

  const sensors = useSensors(
    useSensor(DeviceSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [items, setItems] = useState(
    internalNodes.map((node, index) => {
      if (index === 0) {
        return getUpdatedNodeData(node, {
          nodeData: {
            inputData: rootInputData,
            outputData: node.data.execution?.config?.nodeData?.outputData,
          },
        });
      }
      if (index + 1 === internalNodes.length) {
        return getUpdatedNodeData(node, {
          nodeData: {
            ...node.data.execution?.config?.nodeData,
            inputData:
              internalNodes[index - 1]?.data.execution?.config?.nodeData
                ?.outputData,
          },
        });
      }
      return node;
    }),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function getUpdatedNodeData(node: WorkflowNode, config: ExecutionConfig) {
    return {
      ...node,
      data: {
        ...node.data,
        execution: {
          ...node.data.execution,
          config: {
            ...node.data.execution?.config,
            ...config,
            nodeData: {
              ...node.data.execution?.config?.nodeData,
              ...config.nodeData,
            },
          },
        },
      },
    };
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOnRunCode =
    (index: number) => (nodeData: ExecutionConfig["nodeData"]) => {
      setItems((nodes) =>
        nodes.map((node, itemIndex) => {
          if (index === itemIndex) {
            return getUpdatedNodeData(node, {
              nodeData: {
                inputData:
                  itemIndex === 0
                    ? rootInputData
                    : nodes[index - 1]?.data.execution?.config?.nodeData
                        ?.outputData,
                outputData: nodeData?.outputData,
              },
            });
          } else if (itemIndex === 0) {
            return getUpdatedNodeData(node, {
              nodeData: {
                inputData: rootInputData,
              },
            });
          }

          if (index + 1 === itemIndex) {
            return getUpdatedNodeData(node, {
              nodeData: {
                ...node.data.execution?.config?.nodeData,
                inputData: nodeData?.outputData,
              },
            });
          }

          return getUpdatedNodeData(node, {
            nodeData: {
              outputData: nodeData?.outputData,
            },
          });
        }),
      );
    };

  const updateSorting = ({ active, over }: DragEndEvent) => {
    if (!over) return;

    const { id: activeId } = active;
    const { id: overId } = over;
    if (activeId === overId) return;
    let newItems = [...items];

    setItems((items) => {
      const oldIndex = items.findIndex(({ id }) => id === activeId);
      const newIndex = items.findIndex(({ id }) => id === overId);

      const updated = arrayMove(items, oldIndex, newIndex);

      newItems = updated;
      return updated;
    });

    onReorder?.(newItems);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;

    updateSorting(event);
  };

  if (!internalNodes || internalNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic border rounded-lg bg-gray-50">
        No internal nodes
      </div>
    );
  }

  const handleRemove = ({ id }: WorkflowNode) => {
    let newItems = [...items];

    setItems((items) => {
      const updated = items.filter((item) => item.id !== id);

      newItems = updated;
      return updated;
    });
    onRemove?.(newItems);
  };

  function handlePropertiesSave(
    nodeId: string,
    nodeData: WorkflowNode["data"],
  ) {
    let newItems = [...items];

    flushSync(() => {
      setItems((nodes) => {
        const updated = nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...nodeData,
              },
            };
          }
          return node;
        });
        newItems = updated;

        return updated;
      });
    });

    onInternalNodePropertiesSave?.(nodeId, newItems);
  }

  const handleSave = (nodeId: string) => (config: ExecutionConfig) => {
    let newItems = [...items];

    flushSync(() => {
      setItems((nodes) => {
        const updated = nodes.map((node, index) => {
          if (node.id === nodeId) {
            return getUpdatedNodeData(node, {
              ...config,
              nodeData: {
                inputData:
                  index === 0
                    ? rootInputData
                    : nodes[index - 1]?.data.execution?.config?.nodeData
                        ?.outputData,
              },
            });
          }

          return node;
        });

        newItems = updated;

        return updated;
      });
    });

    toggleExpand(nodeId);
    onInternalNodeConfigSave?.(nodeId, newItems);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      autoScroll={false}
      // onDragMove={onDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-y-auto space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-3 block">
          Internal Node I/O Flow
        </label>

        <SortableContext
          items={items?.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          {items.map((node, index) => {
            const isExpanded = expandedIds.has(node.id);
            const outputData =
              node.data.execution?.config?.nodeData?.outputData;

            return (
              <Fragment key={node.id}>
                <GroupDataFlowView
                  node={node}
                  isExpanded={isExpanded}
                  expandedContent={
                    <ExecutorEditorContent
                      isVisibleTypeHint={false}
                      isVisibleTestExecutor={false}
                      nodeType={node.type!}
                      config={node.data.execution?.config}
                      isSimulated={false}
                      onSave={handleSave(node.id)}
                      onClose={() => toggleExpand(node.id)}
                      onRunCode={handleOnRunCode(index)}
                    />
                  }
                  onToggleExpand={() => toggleExpand(node.id)}
                  onRemoveButtonClick={handleRemove}
                  onOpenPropertiesButtonClick={open}
                />

                {index < items.length - 1 && (
                  <div className="flex flex-col items-center py-1 text-gray-400 text-xs gap-0.5">
                    {isExpanded && outputData != null && (
                      <code className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded font-mono max-w-[90%] truncate">
                        {JSON.stringify(outputData).slice(0, 50)}
                      </code>
                    )}
                    <span>↓</span>
                  </div>
                )}
              </Fragment>
            );
          })}
        </SortableContext>
      </div>
    </DndContext>
  );
}
