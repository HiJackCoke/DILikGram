import Button from "@/components/ui/Button";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";
import { WorkflowNode } from "@/types";
import { inferType, stringifyForDisplay } from "@/utils/workflow";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { PointerEventHandler } from "react";

export default function GroupDataFlowView({
  node,

  onRemove,
}: {
  node: WorkflowNode;

  onRemove?: (id: string) => void;
}) {
  const isClientRendered = useBrowserEnv(({ window }) => !!window, false);

  const {
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    setNodeRef,
  } = useSortable({
    id: node.id,
    data: {
      nodeData: node,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!isClientRendered) return null;
  const nodeData = node.data.execution?.config?.nodeData;
  const inputType = nodeData
    ? inferType(stringifyForDisplay(nodeData.inputData))
    : "—";
  const outputType = nodeData ? inferType(nodeData.outputData) : "—";

  const handleOnPointerDownCapture: PointerEventHandler = async (e) => {
    const target = e.target as HTMLElement;

    if (target.role === "delete-button") {
      const confirm = await dialog.confirm(
        `Delete "${node.data.title}" Node?`,
        `Are you sure you want to delete the internal node "${node.data.title}"?
This action cannot be undone.`,
      );

      if (confirm) {
        onRemove?.(node.id);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDownCapture={handleOnPointerDownCapture}
      className="relative cursor-move p-3 border rounded-lg bg-white text-sm hover:border-blue-400 hover:shadow-md"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400 uppercase px-2 py-0.5 bg-gray-100 rounded">
          {node.type}
        </span>
        {/* <span className="text-xs text-gray-400 font-mono">{index + 1}.</span> */}
        <span className="font-medium flex-1 truncate">
          {node.data?.title || node.id}
        </span>
        {/* <span className="text-xs text-gray-400 uppercase px-2 py-0.5 bg-gray-100 rounded">
          {node.type}
        </span> */}
        <Button
          size="sm"
          role="delete-button"
          variant="ghost"
          palette="danger"
          icon={<Trash2 />}
          onClick={() => onRemove?.(node.id)}
        />
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div>
          <span className="font-semibold">Input: </span>
          <code className="text-blue-700 bg-blue-50 px-1 rounded">
            {inputType}
          </code>
        </div>
        <div>
          <span className="font-semibold">Output: </span>
          <code className="text-blue-700 bg-blue-50 px-1 rounded">
            {outputType}
          </code>
        </div>
      </div>
    </div>
  );
}
