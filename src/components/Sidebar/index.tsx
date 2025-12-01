import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import NodeTemplate from "./NodeTemplate";
import { UNIFIED_NODE_TEMPLATES } from "@/fixtures/nodes";
import type { WorkflowNodeType } from "@/types/nodes";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  // 이벤트 위임: 부모에서 한 번만 처리
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // draggable 요소를 찾기 (NodeTemplate의 최상위 div)
    const draggableElement = target.closest(
      '[draggable="true"]'
    ) as HTMLElement;
    if (!draggableElement) return;

    // data-node-type 속성에서 노드 타입 가져오기
    const type = draggableElement.dataset.nodeType;
    if (!type) return;

    e.dataTransfer.setData("application/nodeType", type);
    e.dataTransfer.effectAllowed = "move";

    // 드래그 시작 시 마우스의 상대 위치를 비율(%)로 계산
    const rect = draggableElement.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 비율(0~1)로 저장
    const ratioX = offsetX / rect.width;
    const ratioY = offsetY / rect.height;

    const distance = {
      x: ratioX,
      y: ratioY,
    };
    e.dataTransfer.setData("application/node", JSON.stringify(distance));
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

      <div
        className={`
          absolute left-4 top-16 z-20 w-72 bg-white border border-gray-200
          rounded-lg shadow-xl overflow-y-auto transition-all duration-300
          ${
            isOpen
              ? "max-h-[calc(100vh-100px)] opacity-100 translate-y-0"
              : "max-h-0 opacity-0 -translate-y-2"
          }
        `}
      >
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">Node Templates</h2>
          <p className="text-xs text-gray-500 mt-1">Drag nodes to canvas</p>
        </div>

        {/* 이벤트 위임: onDragStart를 부모에 한 번만 */}
        <div className="p-4 space-y-3" onDragStart={handleDragStart}>
          {Object.entries(UNIFIED_NODE_TEMPLATES).map(([type, value]) => (
            <NodeTemplate
              key={type}
              type={type as WorkflowNodeType}
              icon={value.icon}
              label={value.label}
              description={value.description}
            />
          ))}
        </div>
      </div>
    </>
  );
}
