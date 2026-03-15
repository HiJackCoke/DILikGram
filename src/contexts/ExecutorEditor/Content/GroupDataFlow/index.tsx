import { useBrowserEnv } from "@/hooks/useBrowserEnv";
import { WorkflowNode } from "@/types";

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
import GroupDataFlowView from "./VIew";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
import { GroupDataFlowProps } from "./type";

export default function GroupDataFlow({
  internalNodes = [],
  onReorder,
  onRemove,
  onInternalNodePropertiesSave,
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

  const [items, setItems] = useState(internalNodes);

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
    let newItems = [...internalNodes];
    setItems((prev) => {
      const updated = prev.map((node) => {
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
    onInternalNodePropertiesSave?.(nodeId, newItems);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      autoScroll={false}
      onDragStart={console.log}
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
          {items.map((node, index) => (
            <Fragment key={node.id}>
              <GroupDataFlowView
                node={node}
                onRemoveButtonClick={handleRemove}
                onOpenPropertiesButtonClick={open}
              />

              {index < internalNodes.length - 1 && (
                <div className="flex justify-center py-1 text-gray-400 text-xs">
                  ↓
                </div>
              )}
            </Fragment>
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
