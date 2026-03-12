import { useEffect, useMemo, useState } from "react";
import ExecutorEditorView from "./View";
import {
  compileExecutor,
  executeFunction,
  detectAsync,
  stringifyForDisplay,
  inferType,
} from "@/utils/workflow";
import type { ExecutionConfig } from "@/types/workflow";
import type { WorkflowNodeType, WorkflowNode } from "@/types/nodes";
import type { TestCase } from "@/types/prd";

interface ExecutorEditorContentProps {
  isInternalNode?: boolean;
  nodeType: WorkflowNodeType;
  config?: ExecutionConfig;
  initialTestCases?: TestCase[];
  isSimulated?: boolean;

  internalNodes?: WorkflowNode[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemoveNode?: (nodeId: string) => void;
  openInternalNode?: (node: WorkflowNode) => void;
  openInternalNodePropertiesPanel?: (node: WorkflowNode) => void;
  onSave: (config: ExecutionConfig) => void;
  onClose?: () => void;
}

export default function ExecutorEditorContent({
  isInternalNode = false,
  nodeType,
  config,
  initialTestCases,
  isSimulated,
  internalNodes,
  onReorder,
  onRemoveNode,
  openInternalNode,
  openInternalNodePropertiesPanel,
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
  const [testCases, setTestCases] = useState<TestCase[]>(
    () => initialTestCases ?? [],
  );

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
      const testConfig: ExecutionConfig = {
        functionCode: code,
        lastModified: Date.now(),
        nodeData: {
          inputData: inputData ? JSON.parse(inputData) : null,
          outputData: null,
        },
      };

      const fn = compileExecutor(testConfig, nodeType, internalNodes);
      const input = JSON.parse(inputData || "null");

      // Determine simulation mode
      const isSimulation = isSimulated ?? false;
      const mockData = config?.nodeData?.outputData;

      // Execute with simulation mode
      const result = await executeFunction(
        fn,
        input,
        30000,
        isSimulation,
        mockData,
      );

      if (!result.success) {
        setOutputData(`Error: ${result.error?.message || "Execution failed"}`);
        return;
      }

      const outputData = JSON.stringify(result.data, null, 2);
      setOutputData(outputData);

      setMeta({
        inputData: input,
        outputData: result.data,
      });
    } catch (error) {
      setOutputData(`Error: ${(error as Error).message}`);
    }
  };

  const handleRunTest = async (testCase: TestCase) => {
    // Update test status to running
    setTestCases((cases) =>
      cases.map((tc) =>
        tc.id === testCase.id ? { ...tc, status: "running" as const } : tc,
      ),
    );

    try {
      const testConfig: ExecutionConfig = {
        functionCode: code,
        lastModified: Date.now(),
      };

      const fn = compileExecutor(testConfig, nodeType, internalNodes);

      // Determine simulation mode
      const isSimulation = isSimulated ?? false;
      const mockData = meta?.outputData ||
        testCase.expectedOutput || { success: true };

      // Execute with simulation mode
      const executionResult = await executeFunction(
        fn,
        testCase.inputData,
        30000,
        isSimulation,
        mockData,
      );

      if (!executionResult.success) {
        setTestCases((cases) =>
          cases.map((tc) =>
            tc.id === testCase.id
              ? {
                  ...tc,
                  status: "failed" as const,
                  error: executionResult.error?.message,
                  lastRun: Date.now(),
                }
              : tc,
          ),
        );
        return;
      }

      const result = executionResult.data;

      // If Code Editor has a reference output (meta.outputData), validate type match.
      const hasReference =
        meta?.outputData !== null && meta?.outputData !== undefined;

      if (hasReference) {
        const actualType = inferType(result);
        const referenceType = inferType(meta!.outputData);
        const typesMatch = actualType === referenceType;

        setTestCases((cases) =>
          cases.map((tc) =>
            tc.id === testCase.id
              ? {
                  ...tc,
                  status: typesMatch
                    ? ("passed" as const)
                    : ("failed" as const),
                  expectedOutput: result,
                  error: typesMatch
                    ? undefined
                    : `Type mismatch.\nExpected type: ${referenceType}\nActual type:   ${actualType}`,
                  lastRun: Date.now(),
                }
              : tc,
          ),
        );
      } else {
        // No reference type available — just store result, mark as passed
        setTestCases((cases) =>
          cases.map((tc) =>
            tc.id === testCase.id
              ? {
                  ...tc,
                  status: "passed" as const,
                  expectedOutput: result,
                  error: undefined,
                  lastRun: Date.now(),
                }
              : tc,
          ),
        );
      }
    } catch (error) {
      // Update test status to failed with error
      setTestCases((cases) =>
        cases.map((tc) =>
          tc.id === testCase.id
            ? {
                ...tc,
                status: "failed" as const,
                error: (error as Error).message,
                lastRun: Date.now(),
              }
            : tc,
        ),
      );
    }
  };

  const handleRunAllTests = async () => {
    for (const testCase of testCases) {
      await handleRunTest(testCase);
    }
  };

  const handleSave = () => {
    if (compileError) return;

    const config: ExecutionConfig & { testCases?: TestCase[] } = {
      functionCode: code,
      lastModified: Date.now(),
      nodeData: {
        inputData: inputData ? JSON.parse(inputData) : null,
        outputData: outputData ? JSON.parse(outputData) : null,
      },
      testCases: testCases.length > 0 ? testCases : undefined,
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
      testCases={testCases}
      onCodeChange={setCode}
      onInputDataChange={setInputData}
      onTest={handleTest}
      onSave={handleSave}
      onClose={onClose}
      onTestCasesChange={setTestCases}
      onRunTest={handleRunTest}
      onRunAllTests={handleRunAllTests}
      internalNodes={internalNodes}
      onReorder={onReorder}
      onRemoveNode={onRemoveNode}
      openInternalNode={openInternalNode}
      openInternalNodePropertiesPanel={openInternalNodePropertiesPanel}
    />
  );
}
