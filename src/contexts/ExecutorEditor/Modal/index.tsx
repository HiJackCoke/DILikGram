/**
 * ExecutorEditorModal - Composition of generic Modal with ExecutorEditorContent
 */
import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import ExecutorEditorContentView from "../Content/View";
import ExecutorEditorDrawer from "../Drawer";
import ExecutorEditorContent from "../Content";

import type { ExecutionConfig } from "@/types/workflow";
import type { ExecutorEditorState } from "@/contexts/ExecutorEditor/type";
import type { WorkflowNode } from "@/types/nodes";
import { ModalProps } from "@/types";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";
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
  const { open } = usePropertiesPanel({
    onSave: handleInternalNodePropertiesSave,
  });

  const [currentInternalNode, setCurrentInternalNode] =
    useState<WorkflowNode | null>(null);

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
  const handleRemoveNode: ExecutorEditorContentProps["onRemoveNode"] = (
    updatedItems,
  ) => {
    setInternalNodes(updatedItems);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updatedItems);
    }
  };

  function handleInternalNodePropertiesSave(
    nodeId: string,
    nodeData: WorkflowNode["data"],
  ) {
    let updatedInternalNodes = [...internalNodes];
    setInternalNodes((prev) => {
      const updated = prev.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...nodeData,
            },
          };
        }

        return node;
      });

      updatedInternalNodes = updated;

      return updated;
    });

    onInternalNodesChange?.(nodeId, updatedInternalNodes);
  }

  // Handle internal node save
  const handleInternalNodeSave = (config: ExecutionConfig) => {
    if (!currentInternalNode) return;

    let updatedInternalNodes = [...internalNodes];

    setInternalNodes((prev) => {
      const updated = prev.map((node) => {
        if (node.id === currentInternalNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              execution: {
                ...node.data.execution,
                config,
              },
            },
          };
        }
        return node;
      });

      updatedInternalNodes = updated;

      return updated;
    });

    // Auto-save via callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updatedInternalNodes);
    }

    // Close drawer after save
    setCurrentInternalNode(null);
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
          onRemoveNode={nodeType === "group" ? handleRemoveNode : undefined}
          openInternalNode={
            nodeType === "group" ? setCurrentInternalNode : undefined
          }
          openInternalNodePropertiesPanel={
            nodeType === "group" ? open : undefined
          }
          onSave={handleSave}
          onClose={onClose}
        />
      )}

      {/* Overlay layer - drawer slides in from right */}

      <ExecutorEditorDrawer
        show={!!currentInternalNode}
        nodeId={currentInternalNode?.id}
        nodeType={currentInternalNode?.type}
        config={currentInternalNode?.data.execution?.config}
        parentTitle={description}
        onSave={handleInternalNodeSave}
        onClose={() => setCurrentInternalNode(null)}
      />
    </Modal>
  );
}
