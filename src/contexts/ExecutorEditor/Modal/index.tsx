/**
 * ExecutorEditorModal - Composition of generic Modal with ExecutorEditorContent
 */
import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import ExecutorEditorContentView from "../Content/View";

import ExecutorEditorContent from "../Content";

import type { ExecutionConfig } from "@/types/workflow";
import type { ExecutorEditorState } from "@/contexts/ExecutorEditor/type";
import type { WorkflowNode } from "@/types/nodes";
import { ModalProps } from "@/types";

import { useWorkflowExecution } from "@/contexts/WorkflowExecution";
import { Beaker, FlaskConical } from "lucide-react";
import { ExecutorEditorContentProps } from "../Content/type";

type ExecutorEditorModalProps = Partial<ExecutorEditorState> &
  Pick<ModalProps, "show" | "onClose"> & {
    onSave: (
      config: ExecutionConfig,
      internalNodes?: WorkflowNode[], //  For group nodes
    ) => void;
    onInternalNodesChange?: (
      nodeId: string,
      internalNodes: WorkflowNode[],
    ) => void;
  };

export default function ExecutorEditorModal({
  show,
  nodeId,
  nodeType,
  config,
  internalNodes: initialInternalNodes,
  testCases: initialTestCases,

  onSave,
  onInternalNodesChange,

  onClose,
}: ExecutorEditorModalProps) {
  const { isSimulated, setIsSimulated } = useWorkflowExecution();

  const [internalNodes, setInternalNodes] = useState<WorkflowNode[]>(
    initialInternalNodes || [],
  );

  const description = useMemo(
    () => `Node: ${nodeId} (${nodeType})`,
    [nodeId, nodeType],
  );

  const handleReorder: ExecutorEditorContentProps["onReorder"] = (
    updatedItems,
  ) => {
    setInternalNodes(updatedItems);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updatedItems);
    }
  };

  // Remove node from group
  const handleRemoveNode: ExecutorEditorContentProps["onRemove"] = (
    updatedItems,
  ) => {
    setInternalNodes(updatedItems);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updatedItems);
    }
  };

  const handleInternalNodePropertiesSave = (
    nodeId: string,
    updatedItems: WorkflowNode[],
  ) => {
    setInternalNodes(updatedItems);

    onInternalNodesChange?.(nodeId, updatedItems);
  };

  // Handle internal node save
  const handleInternalNodeSave = (
    nodeId: string,
    updatedItems: WorkflowNode[],
  ) => {
    setInternalNodes(updatedItems);

    onInternalNodesChange?.(nodeId, updatedItems);
  };

  const handleSave = (config: ExecutionConfig) => {
    if (nodeType === "group") {
      onSave(config, internalNodes);
    } else {
      onSave(config);
    }
    onClose?.();
  };

  const ModalDescription = (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">{description}</span>
      {(nodeType === "service" || nodeType === "group") && (
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
  );

  return (
    <Modal
      title={<ExecutorEditorContentView.Title />}
      description={ModalDescription}
      show={show}
      onClose={onClose}
    >
      {nodeId && nodeType && (
        <ExecutorEditorContent
          nodeType={nodeType}
          config={config}
          initialTestCases={initialTestCases}
          isSimulated={isSimulated}
          internalNodes={nodeType === "group" ? internalNodes : undefined}
          onReorder={nodeType === "group" ? handleReorder : undefined}
          onRemove={nodeType === "group" ? handleRemoveNode : undefined}
          onInternalNodePropertiesSave={
            nodeType === "group" ? handleInternalNodePropertiesSave : undefined
          }
          onInternalNodeConfigSave={
            nodeType === "group" ? handleInternalNodeSave : undefined
          }
          onSave={handleSave}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
