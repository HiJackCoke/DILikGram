/**
 * ExecutorEditorModal - Composition of generic Modal with ExecutorEditorContent
 */
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import ExecutorEditorView from "./View";

import {
  compileExecutor,
  detectAsync,
  stringifyForDisplay,
} from "@/utils/workflow";

import type { ExecutionConfig } from "@/types/workflow";
import type { ExecutorEditorState } from "@/contexts/ExecutorEditor/type";
import type { WorkflowNode } from "@/types/nodes";
import { ModalProps } from "@/types";

type ExecutorEditorModalProps = Partial<ExecutorEditorState> &
  Pick<ModalProps, "show" | "onClose"> & {
    onSave: (
      config: ExecutionConfig,
      internalNodes?: WorkflowNode[], //  For group nodes
    ) => void;
    onInternalNodesChange?: (
      nodeId: string,
      internalNodes: WorkflowNode[],
      config: ExecutionConfig,
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
  // Initialize state directly from props
  const [code, setCode] = useState(() => config?.functionCode || "");
  const [meta, setMeta] = useState(() => config?.nodeData);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [inputData, setInputData] = useState(() =>
    stringifyForDisplay(config?.nodeData?.inputData),
  );
  const [outputData, setOutputData] = useState<string | null>(null);

  // Internal nodes state (only for group nodes)
  const [internalNodes, setInternalNodes] = useState<WorkflowNode[]>(
    initialInternalNodes || [],
  );

  // Reset code when config changes

  // Auto-detect if code is async
  const isAsync = useMemo(() => detectAsync(code), [code]);

  // Validate code on change
  const validationError = useMemo(() => {
    if (!code.trim()) {
      return null;
    }

    try {
      const config: ExecutionConfig = {
        functionCode: code,
        lastModified: 0, // Dummy value for validation
      };
      // Pass nodeType for validation (TaskNode must be sync)
      compileExecutor(config, nodeType);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, [code, nodeType]);

  useEffect(() => {
    setCode(config?.functionCode || "");
    setOutputData(null);
    setCompileError(null);
  }, [config?.functionCode]);

  // Update compile error state when validation changes
  useEffect(() => {
    setCompileError(validationError);
  }, [validationError]);

  const handleTest = async () => {
    try {
      const config: ExecutionConfig = {
        functionCode: code,
        lastModified: Date.now(),
      };
      const fn = compileExecutor(config);
      const input = JSON.parse(inputData);
      const result = await Promise.resolve(fn(input, fetch));
      const outputData = JSON.stringify(result, null, 2);

      setOutputData(outputData);
      setMeta({
        inputData: JSON.parse(inputData),
        outputData: outputData ? JSON.parse(outputData) : null,
      });
    } catch (error) {
      setOutputData(`Error: ${(error as Error).message}`);
    }
  };

  // Reorder internal nodes
  const handleReorder = (fromIndex: number, toIndex: number) => {
    const updated = [...internalNodes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setInternalNodes(updated);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updated, {
        functionCode: code,
        lastModified: Date.now(),
        nodeData: {
          inputData: inputData ? JSON.parse(inputData) : null,
          outputData: outputData ? JSON.parse(outputData) : null,
        },
      });
    }
  };

  // Remove node from group
  const handleRemoveNode = (nodeIdToRemove: string) => {
    const updated = internalNodes.filter((n) => n.id !== nodeIdToRemove);
    setInternalNodes(updated);

    // Auto-save via new callback
    if (nodeId && onInternalNodesChange) {
      onInternalNodesChange(nodeId, updated, {
        functionCode: code,
        lastModified: Date.now(),
        nodeData: {
          inputData: inputData ? JSON.parse(inputData) : null,
          outputData: outputData ? JSON.parse(outputData) : null,
        },
      });
    }
  };

  const handleSave = () => {
    if (compileError) return;

    const config: ExecutionConfig = {
      functionCode: code,
      lastModified: Date.now(),
      nodeData: {
        inputData: JSON.parse(inputData),
        outputData: outputData ? JSON.parse(outputData) : null,
      },
    };

    // For group nodes, pass internalNodes as second parameter
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
      description={`Node: ${nodeId} (${nodeType})`}
      show={show}
      onClose={onClose}
    >
      {nodeId && nodeType && (
        <ExecutorEditorView
          meta={meta}
          nodeType={nodeType}
          code={code}
          isAsync={isAsync}
          error={compileError}
          inputData={inputData}
          outputData={outputData}
          onCodeChange={setCode}
          onInputDataChange={setInputData}
          onTest={handleTest}
          onSave={handleSave}
          onClose={onClose}
          internalNodes={nodeType === "group" ? internalNodes : undefined}
          onReorder={nodeType === "group" ? handleReorder : undefined}
          onRemoveNode={nodeType === "group" ? handleRemoveNode : undefined}
        />
      )}
    </Modal>
  );
}
