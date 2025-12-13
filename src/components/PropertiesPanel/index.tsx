import { X } from "lucide-react";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";
import DynamicNodeEditor from "./Editor";

import useKeyPress from "@/hooks/useKeyPress";

interface PropertiesPanelModalProps {
  node?: WorkflowNode;
  edges: WorkflowEdge[];
  open: boolean;
  onSave: (data: Partial<WorkflowNode["data"]>) => void;
  onClose: () => void;
}

export default function PropertiesPanelModal({
  node,
  edges,
  open,
  onSave,
  onClose,
}: PropertiesPanelModalProps) {
  useKeyPress("escape", () => {
    onClose();
  });

  const renderEditor = () => {
    if (!node) return null;

    return <DynamicNodeEditor node={node} edges={edges} onSave={onSave} />;
  };

  return (
    <>
      {/* Backdrop */}
      {/* <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      /> */}

      {/* Side Panel */}
      <div
        className={`
          fixed right-0 top-0 h-full w-96 bg-slate-800 shadow-2xl z-50 flex flex-col
          transition-all duration-300 ease-out
          ${open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Node Properties
            </h2>
            {node?.type && (
              <p className="text-sm text-slate-400 mt-1">
                {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node •{" "}
                {node.id}
              </p>
            )}
          </div>
          <button
            onClick={() => onClose()}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{renderEditor()}</div>
      </div>
    </>
  );
}
