import { useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import NodeTemplate from "./NodeTemplate";
import { UNIFIED_NODE_TEMPLATES } from "@/fixtures/nodes";
import type { WorkflowNodeType } from "@/types/nodes";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { XYPosition } from "react-cosmos-diagram";

interface SidebarProps {
  onDragStart?: (event: DragStartEvent, distance: XYPosition) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
}

const hasMouseSupport = (): boolean => {
  const hasPointerFine = window.matchMedia("(pointer: fine)").matches;

  const hasTouchSupport =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  return hasPointerFine && !hasTouchSupport;
};

const getTranslateXYValues = (element: HTMLElement | null) => {
  if (!element) return { x: 0, y: 0, z: 0 };
  const style = window.getComputedStyle(element);
  const matrix = new WebKitCSSMatrix(style.transform);

  return {
    x: matrix.m41, // translateX
    y: matrix.m42, // translateY
    z: matrix.m43,
  };
};

export default function Sidebar({
  onDragStart,
  onDragMove,
  onDragEnd,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sortingRef = useRef<ReturnType<CollisionDetection>>([]);

  const sensors = useSensors(
    useSensor(hasMouseSupport() ? PointerSensor : TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [isOpen, setIsOpen] = useState(false);

  const [sidebarItems, setSidebarItems] = useState(
    Object.entries(UNIFIED_NODE_TEMPLATES).map(([type, value]) => ({
      id: type, // unique identifier for @dnd-kit
      type: type as WorkflowNodeType,
      icon: value.icon,
      label: value.label,
      description: value.description,
    }))
  );

  const customCollisionDetection: CollisionDetection = (args) => {
    const { pointerCoordinates } = args;

    if (!pointerCoordinates) {
      return closestCorners(args);
    }

    const sidebarRect = sidebarRef.current?.getBoundingClientRect();

    if (!sidebarRect) {
      return closestCorners(args);
    }

    const isOutside =
      pointerCoordinates.x < sidebarRect.left ||
      pointerCoordinates.x > sidebarRect.right ||
      pointerCoordinates.y < sidebarRect.top ||
      pointerCoordinates.y > sidebarRect.bottom;

    if (isOutside) {
      return sortingRef.current;
    } else {
      sortingRef.current = closestCorners(args);
    }

    return closestCorners(args);
  };

  const handleDragStart = (event: DragStartEvent) => {
    // activatorEvent에서 클릭 위치 가져오기
    const activatorEvent = event.activatorEvent;
    const target = activatorEvent.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    if (hasMouseSupport()) {
      const pointerEvent = activatorEvent as PointerEvent;

      const rateX = (pointerEvent.x - rect.x) / rect.width;
      const rateY = (pointerEvent.y - rect.y) / rect.height;

      onDragStart?.(event, { x: rateX, y: rateY });
    } else {
      const touchEvent = activatorEvent as TouchEvent;
      const touch = touchEvent.touches?.[0];

      const { x, y } = getTranslateXYValues(target.parentElement);

      const layerX = touch.clientX - rect.left + x;
      const layerY = touch.clientY - rect.top + y;

      const rateX = layerX / rect.width;
      const rateY = layerY / rect.height;

      onDragStart?.(event, { x: rateX, y: rateY });
    }

    // onDragStart?.(event);
  };

  const updateSorting = ({ active, over }: DragEndEvent) => {
    if (!over) return;

    const { id: activeId } = active;
    const { id: overId } = over;

    if (activeId === overId) return;
    setSidebarItems((items) => {
      const oldIndex = items.findIndex(({ id }) => id === activeId);
      const newIndex = items.findIndex(({ id }) => id === overId);

      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;

    updateSorting(event);
    onDragEnd?.(event);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-4 top-4 z-30 p-2 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
      >
        {isOpen ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {/* Sidebar Panel */}

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        autoScroll={false}
        onDragStart={handleDragStart}
        onDragMove={onDragMove}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={sidebarRef}
          className={`
          absolute left-4 top-16 z-20 w-72 bg-white border border-gray-200
          rounded-lg shadow-xl overflow-visible transition-all duration-300
          ${
            isOpen
              ? "max-h-[calc(100vh-100px)] opacity-100 translate-y-0"
              : "max-h-0 opacity-0 -translate-y-2"
          }
        `}
        >
          <div className="p-4 border-b rounded-t-lg bg-gray-50">
            <h2 className="font-semibold text-gray-900">Node Templates</h2>
            <p className="text-xs text-gray-500 mt-1">Drag nodes to canvas</p>
          </div>

          {/* SortableContext for @dnd-kit drag-and-drop */}
          <div className="p-4 space-y-3">
            <SortableContext
              items={sidebarItems.map((item) => item.id)}
              strategy={rectSortingStrategy}
            >
              {sidebarItems.map(({ id, type, icon, label, description }) => (
                <NodeTemplate
                  key={id}
                  id={id}
                  type={type}
                  icon={icon}
                  label={label}
                  description={description}
                />
              ))}
            </SortableContext>
          </div>
        </div>
      </DndContext>
    </>
  );
}
