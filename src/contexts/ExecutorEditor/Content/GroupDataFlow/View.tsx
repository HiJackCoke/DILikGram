import Button from "@/components/ui/Button";
import Collapse from "@/components/ui/Collapse";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";
import { WorkflowNode } from "@/types";
import { inferType } from "@/utils/workflow";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Edit,
  GripVertical,
  Trash2,
} from "lucide-react";
import { ReactNode } from "react";

export default function GroupDataFlowView({
  node,
  isExpanded = false,
  expandedContent,
  onToggleExpand,
  onRemoveButtonClick,
  onOpenPropertiesButtonClick,
}: {
  node: WorkflowNode;
  isExpanded?: boolean;
  expandedContent?: ReactNode;
  onToggleExpand?: () => void;
  onRemoveButtonClick?: (node: WorkflowNode) => void;
  onOpenPropertiesButtonClick?: (node: WorkflowNode) => void;
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
    data: { nodeData: node },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!isClientRendered) return null;

  const nodeData = node.data.execution?.config?.nodeData;
  const inputType = nodeData?.inputData
    ? inferType(nodeData.inputData)
    : "undefined";
  const outputType = nodeData?.outputData
    ? inferType(nodeData.outputData)
    : "undefined";

  const handleOnDeleteButtonClick = async () => {
    const confirm = await dialog.confirm(
      `Delete "${node.data.title}" Node?`,
      `Are you sure you want to delete the internal node "${node.data.title}"?\nThis action cannot be undone.`,
    );
    if (confirm) onRemoveButtonClick?.(node);
  };

  return (
    <div
      className={`relative border rounded-lg bg-white text-sm transition-shadow ${
        isExpanded
          ? "border-blue-400 shadow-md"
          : "hover:border-blue-400 hover:shadow-md"
      }`}
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      {/* Header — drag handle only */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        // {...listeners}
        // onPointerDownCapture={handleOnPointerDownCapture}
      >
        <Button
          {...listeners}
          className="cursor-move"
          size="sm"
          variant="ghost"
          icon={<GripVertical />}
        />

        <span className="text-xs text-gray-400 uppercase px-2 py-0.5 bg-gray-100 rounded">
          {node.type}
        </span>
        <span className="font-medium flex-1 truncate">
          {node.data?.title || node.id}
        </span>
        <div className="flex items-center">
          <Button
            size="sm"
            variant="ghost"
            role="open-properties-button"
            palette="primary"
            icon={<Edit />}
            onClick={() => onOpenPropertiesButtonClick?.(node)}
          />
          <Button
            size="sm"
            role="delete-button"
            variant="ghost"
            palette="danger"
            icon={<Trash2 />}
            onClick={handleOnDeleteButtonClick}
          />
          <Button
            size="sm"
            role="expand-button"
            variant="ghost"
            palette="primary"
            icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
            onClick={onToggleExpand}
          />
        </div>
      </div>

      {/* Collapsed: I/O type summary */}
      {/* {!isExpanded && ( */}
      <div className="px-3 pb-3 pt-1 space-y-1 text-xs text-gray-600 border-t">
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
      {/* )} */}

      {/* Expanded: inline editor with Collapse animation */}
      <Collapse open={isExpanded}>
        <div
          className="border-t h-[520px] flex flex-col"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {expandedContent}
        </div>
      </Collapse>
    </div>
  );
}
