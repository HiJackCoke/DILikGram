/**
 * ExecutorEditorDrawer - Drawer for editing internal nodes within group nodes
 * Uses generic Drawer component with ExecutorEditorContent
 */
import Drawer from "@/components/ui/Drawer";
import ExecutorEditorContent from "../Content";
import { Switch } from "@/components/ui/Switch";
import { useWorkflowExecution } from "@/contexts/WorkflowExecution";
import { Code, ChevronRight, FlaskConical, Beaker } from "lucide-react";

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
  const { isSimulated, setIsSimulated } = useWorkflowExecution();

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
        <div className="flex items-center justify-between gap-4 w-full">
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
          {nodeType === "service" && (
            <Switch
              label="REAL"
              variant="icon"
              checkedLabel="SIM"
              palette="warning"
              checked={isSimulated}
              icon={<FlaskConical className="text-white" />}
              checkedIcon={<Beaker className="text-white" />}
              onChange={(_, checked) => setIsSimulated(checked)}
            />
          )}
        </div>
      }
      onClose={onClose}
    >
      {nodeId && nodeType && (
        <ExecutorEditorContent
          isInternalNode
          nodeType={nodeType}
          config={config}
          isSimulated={isSimulated}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
