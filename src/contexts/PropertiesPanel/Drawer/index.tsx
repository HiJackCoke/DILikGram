import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";
import DynamicNodeEditor from "./Editor";

import useKeyPress from "@/hooks/useKeyPress";
import Drawer from "@/components/ui/Drawer";

interface PropertiesPanelDrawerProps {
  node?: WorkflowNode;
  edges: WorkflowEdge[];
  open: boolean;
  onSave: (data: Partial<WorkflowNode["data"]>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export default function PropertiesPanelDrawer({
  node,
  edges,
  open,
  onSave,
  onDelete,
  onClose,
}: PropertiesPanelDrawerProps) {
  useKeyPress("escape", () => {
    onClose();
  });

  const drawerClassName = [
    "w-96",
    "bg-slate-800",
    "shadow-2xl",
    "z-40",
    "[&_.drawer-header]:border-slate-700",
    "[&_.drawer-header_button]:text-slate-400",
    "[&_.drawer-header_button]:hover:bg-slate-700",
    "[&_.drawer-header_button]: rounded-lg",
  ].join(" ");

  return (
    <Drawer
      className={drawerClassName}
      title={
        <div>
          <h2 className="text-lg font-semibold text-white">Node Properties</h2>
          {node?.type && (
            <p className="text-sm text-slate-400 mt-1">
              {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node •{" "}
              {node.id}
            </p>
          )}
        </div>
      }
      show={open}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto">
        {node && (
          <DynamicNodeEditor
            key={node.id}
            node={node}
            edges={edges}
            onSave={onSave}
            onDelete={onDelete}
          />
        )}
      </div>
    </Drawer>
  );
}
