/**
 * ExecutorEditorDrawer - Drawer for editing internal nodes within group nodes
 * Uses generic Drawer component with ExecutorEditorContent
 */
import Drawer from "@/components/ui/Drawer";
import ExecutorEditorContent from "../Content";
import { Code, ChevronRight } from "lucide-react";

import type { ExecutionConfig } from "@/types/workflow";
import { WorkflowNodeType } from "@/types";

interface ExecutorEditorDrawerProps {
  show: boolean;
  nodeId?: string;
  nodeType?: WorkflowNodeType;
  config?: ExecutionConfig;
  parentTitle?: string;

  onSave: (config: ExecutionConfig) => void;
  onClose: () => void;
}

export default function ExecutorEditorDrawer({
  show,
  nodeId,
  nodeType,
  config,
  parentTitle,

  onSave,
  onClose,
}: ExecutorEditorDrawerProps) {
  const drawerClassName = [
    "rounded-xl",
    "[&_.drawer-body]:p-0",
    "[&_.drawer-body]:flex",
    "[&_.drawer-body]:flex-col",
  ].join(" ");

  return (
    <Drawer
      className={drawerClassName}
      show={show}
      portal={false}
      position="right"
      width="90%"
      mask={false}
      maskClosable={false}
      keyboard={true}
      zIndex={10}
      title={
        <div>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            <span>Edit Internal Node</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span>{parentTitle}</span>
            <ChevronRight className="w-3 h-3" />
            <span>{nodeType}</span>
          </div>
        </div>
      }
      onClose={onClose}
    >
      {nodeId && nodeType && (
        <ExecutorEditorContent
          isInternalNode
          nodeType={nodeType}
          config={config}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
