/**
 * ExecutorEditorModal - Composition of generic Modal with ExecutorEditorContent
 */
import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import ExecutorEditorView from "../Content/View";
import ExecutorEditorDrawer from "../Drawer";
import ExecutorEditorContent from "../Content";

import type { ExecutionConfig } from "@/types/workflow";
import type { ExecutorEditorState } from "@/contexts/ExecutorEditor/type";
import type { WorkflowNode } from "@/types/nodes";
import { ModalProps } from "@/types";
import { usePropertiesPanel } from "@/contexts/PropertiesPanel";

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

  onSave,
  onInternalNodesChange,

  onClose,
}: ExecutorEditorModalProps) {
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

  // Reorder internal nodes
  const handleReorder = (fromIndex: number, toIndex: number) => {
    const updated = [...internalNodes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setInternalNodes(updated);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updated);
    }
  };

  // Remove node from group
  const handleRemoveNode = (nodeIdToRemove: string) => {
    const updated = internalNodes.filter((n) => n.id !== nodeIdToRemove);
    setInternalNodes(updated);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updated);
    }
  };

  function handleInternalNodePropertiesSave(
    nodeId: string,
    nodeData: WorkflowNode["data"],
  ) {
    const updated = internalNodes.map((node) => {
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

    setInternalNodes(updated);
    onInternalNodesChange?.(nodeId, updated);
  }

  // Handle internal node save
  const handleInternalNodeSave = (config: ExecutionConfig) => {
    if (!currentInternalNode) return;

    const updated = internalNodes.map((node) => {
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

    setInternalNodes(updated);

    // Auto-save via callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updated);
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

  return (
    <Modal
      title={<ExecutorEditorView.Title />}
      description={description}
      show={show}
      onClose={onClose}
    >
      {nodeId && nodeType && (
        <ExecutorEditorContent
          nodeType={nodeType}
          config={config}
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
