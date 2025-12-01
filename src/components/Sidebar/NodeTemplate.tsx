import type { WorkflowNodeType } from "@/types/nodes";

type NodeTemplateProps = {
  type: WorkflowNodeType;
  icon: React.ReactNode;
  label: string;
  description: string;
};

export default function NodeTemplate({
  type,
  icon,
  label,
  description,
}: NodeTemplateProps) {
  return (
    <div
      draggable
      data-node-type={type}
      className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg cursor-move hover:border-blue-400 hover:bg-blue-50 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
    </div>
  );
}
