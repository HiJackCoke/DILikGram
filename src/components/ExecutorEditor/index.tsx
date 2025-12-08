/**
 * ExecutorEditorModal - Composition of generic Modal with ExecutorEditorContent
 */
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import ExecutorEditorView from "./View";

import { compileExecutor, detectAsync } from "@/utils/executorRuntime";

import type { ExecutorConfig } from "@/types/executor";
import type { ExecutorEditorState } from "@/contexts/ExecutorEditor/type";
import { stringifyForDisplay } from "@/utils/executorHelpers";

type ExecutorEditorModalProps = Partial<ExecutorEditorState> & {
  open: boolean;
  onSave: (config: ExecutorConfig) => void;
  onClose: () => void;
};

export default function ExecutorEditorModal({
  open,
  nodeId,
  nodeType,
  config,
  onSave,
  onClose,
}: ExecutorEditorModalProps) {
  // Initialize state directly from props
  const [code, setCode] = useState(() => config?.functionCode || "");
  const [meta, setMeta] = useState(() => config?.__meta);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [inputData, setInputData] = useState(() =>
    stringifyForDisplay(config?.__meta?.inputType)
  );
  const [outputData, setOutputData] = useState<string | null>(null);

  // Reset code when config changes

  // Auto-detect if code is async
  const isAsync = useMemo(() => detectAsync(code), [code]);

  // Validate code on change
  const validationError = useMemo(() => {
    if (!code.trim()) {
      return null;
    }

    try {
      const config: ExecutorConfig = {
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
      const config: ExecutorConfig = {
        functionCode: code,
        lastModified: Date.now(),
      };
      const fn = compileExecutor(config);
      const input = JSON.parse(inputData);
      const result = await Promise.resolve(fn(input, fetch));
      const outputData = JSON.stringify(result, null, 2);

      setOutputData(outputData);
      setMeta({
        inputType: JSON.parse(inputData),
        outputType: outputData ? JSON.parse(outputData) : null,
      });
    } catch (error) {
      setOutputData(`Error: ${(error as Error).message}`);
    }
  };

  const handleSave = () => {
    if (compileError) return;

    const config: ExecutorConfig = {
      functionCode: code,
      lastModified: Date.now(),
      __meta: {
        inputType: JSON.parse(inputData),
        outputType: outputData ? JSON.parse(outputData) : null,
      },
    };
    onSave(config);
    onClose();
  };

  return (
    <Modal
      selector="#executor-modal"
      title={<ExecutorEditorView.Title />}
      description={`Node: ${nodeId} (${nodeType})`}
      open={open}
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
        />
      )}
    </Modal>
  );
}
