import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WorkflowNodeType } from "@/types/nodes";

interface DraggableNodeTemplateProps {
  id: string;
  type: WorkflowNodeType;
  icon: React.ReactNode;
  label: string;
  description: string;
}

export default function NodeTemplate({
  id,
  type,
  icon,
  label,
  description,
}: DraggableNodeTemplateProps) {
  const {
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    setNodeRef,
  } = useSortable({
    id,
    data: {
      type,
      // Store data that will be accessible in handleDragEnd
      nodeTemplate: { type, icon, label, description },
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move rounded-lg border-2 border-gray-300 bg-white p-4  hover:border-blue-400 hover:shadow-md"
    >
      <div className="pointer-events-none flex items-center gap-3">
        {icon}
        <div>
          <p className="font-medium text-gray-800">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
}
