import { useEffect, useMemo, useState } from "react";
import ExecutorEditorView from "./View";
import {
  compileExecutor,
  detectAsync,
  stringifyForDisplay,
} from "@/utils/workflow";
import type { ExecutionConfig } from "@/types/workflow";
import type { WorkflowNodeType, WorkflowNode } from "@/types/nodes";

interface ExecutorEditorContentProps {
  isInternalNode?: boolean;
  nodeType: WorkflowNodeType;
  config?: ExecutionConfig;

  // Optional props for group nodes
  internalNodes?: WorkflowNode[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemoveNode?: (nodeId: string) => void;
  openInternalNode?: (node: WorkflowNode) => void;

  // Handlers
  onSave: (config: ExecutionConfig) => void;
  onClose?: () => void;
}

export default function ExecutorEditorContent({
  isInternalNode = false,
  nodeType,
  config,
  internalNodes,
  onReorder,
  onRemoveNode,
  openInternalNode,
  onSave,
  onClose,
}: ExecutorEditorContentProps) {
  // State management
  const [code, setCode] = useState(() => config?.functionCode || "");
  const [meta, setMeta] = useState(() => config?.nodeData);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [inputData, setInputData] = useState(() =>
    stringifyForDisplay(config?.nodeData?.inputData),
  );
  const [outputData, setOutputData] = useState<string | null>(null);

  // Computed values
  const isAsync = useMemo(() => detectAsync(code), [code]);

  const validationError = useMemo(() => {
    if (!code.trim()) return null;
    try {
      const config: ExecutionConfig = {
        functionCode: code,
        lastModified: 0,
      };
      compileExecutor(config, nodeType);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, [code, nodeType]);

  // Effects
  useEffect(() => {
    setCode(config?.functionCode || "");
    setOutputData(null);
    setCompileError(null);
  }, [config?.functionCode]);

  useEffect(() => {
    setCompileError(validationError);
  }, [validationError]);

  // Handlers
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

  const handleSave = () => {
    console.log(12312, compileError);
    if (compileError) return;

    const config: ExecutionConfig = {
      functionCode: code,
      lastModified: Date.now(),
      nodeData: {
        inputData: inputData ? JSON.parse(inputData) : null,
        outputData: outputData ? JSON.parse(outputData) : null,
      },
    };

    onSave(config);
  };

  return (
    <ExecutorEditorView
      isInternalNode={isInternalNode}
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
      internalNodes={internalNodes}
      onReorder={onReorder}
      onRemoveNode={onRemoveNode}
      openInternalNode={openInternalNode}
    />
  );
}
