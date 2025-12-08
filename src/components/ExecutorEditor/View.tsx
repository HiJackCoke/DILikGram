import { Play, AlertTriangle, Zap, Code } from "lucide-react";
import type { ExecutorConfig } from "@/types/executor";
import type { WorkflowNodeType } from "@/types/nodes";
import { inferType, stringifyForDisplay } from "@/utils/executorHelpers";

type ExecutorEditorViewProps = {
  meta: ExecutorConfig["__meta"];
  nodeType: WorkflowNodeType;
  code: string;
  isAsync: boolean;
  error: string | null;
  inputData: string;
  outputData: string | null;

  onCodeChange: (code: string) => void;
  onInputDataChange: (input: string) => void;
  onTest: () => Promise<void>;
  onSave: () => void;
  onClose: () => void;
};

/**
 * Format unknown type value for display in UI
 */

export default function ExecutorEditorView({
  meta,
  nodeType,
  code,
  isAsync,
  error,
  inputData,
  outputData,

  onCodeChange,
  onInputDataChange,
  onTest,
  onSave,
  onClose,
}: ExecutorEditorViewProps) {
  return (
    <>
      {/* Content */}

      <div className="flex-1 overflow-hidden flex">
        {/* Editor */}
        <div className="flex-1 flex flex-col p-6 border-r">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Function Code
            </label>
            {/* Async Detection Indicator */}
            {isAsync && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Zap className="w-3 h-3" />
                <span>Async Detected</span>
              </div>
            )}
            {/* TaskNode async warning */}
            {nodeType === "task" && isAsync && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                <span>TaskNode must be sync - use ServiceNode instead</span>
              </div>
            )}
          </div>

          {/* Type Hints */}
          {meta && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1.5">
              <div className="text-gray-700">
                <span className="font-semibold">Input Type:</span>{" "}
                <code className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                  {inferType(stringifyForDisplay(meta.inputType))}
                </code>
              </div>
              <div className="text-gray-700">
                <span className="font-semibold">Output Type:</span>{" "}
                <code className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                  {inferType(meta.outputType)}
                </code>
              </div>
            </div>
          )}

          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder={
              nodeType === "decision"
                ? `// Decision evaluator - return structured output\n// Example:\nconst isValid = nodeInput && nodeInput.isValid === true;\n\nreturn {\n  nodeOutput: { ...nodeInput, checked: true },\n  success: isValid  // true = Yes, false = No\n};`
                : nodeType === "task"
                  ? `// Task function (SYNC ONLY - no await/async)\n// Receives: nodeInput, fetch\n// Returns: transformed data\n\nreturn { ...nodeInput };`
                  : meta
                    ? `// Receives: nodeInput (${stringifyForDisplay(meta.inputType)})\n// Returns: ${stringifyForDisplay(meta.outputType)}\n\nreturn nodeOutput;`
                    : `// Your function code here\n// Receives: nodeInput, fetch\n// Return: output data\n\nreturn nodeInput;`
            }
            className="flex-1 w-full p-4 font-mono text-sm border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            spellCheck={false}
          />

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Compilation Error
                </p>
                <p className="text-xs text-red-600 mt-1 font-mono">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Test Panel */}
        <div className="w-80 flex flex-col p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Test Executor
          </h3>

          <label className="text-xs text-gray-600 mb-2">
            Input Data (JSON)
          </label>
          <textarea
            value={inputData}
            onChange={(e) => onInputDataChange(e.target.value)}
            className="h-24 p-3 font-mono text-xs border rounded-lg resize-none mb-3"
            placeholder='{"key": "value"}'
          />

          <button
            onClick={onTest}
            disabled={!!error}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition mb-3"
          >
            <Play className="w-4 h-4" />
            Run Test
          </button>

          {outputData && (
            <>
              <label className="text-xs text-gray-600 mb-2">Output</label>
              <div className="flex-1 p-3 font-mono text-xs bg-gray-50 border rounded-lg overflow-auto">
                <pre className="whitespace-pre-wrap">{outputData}</pre>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!!error || !code.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition"
        >
          Save Function
        </button>
      </div>
    </>
  );
}

const Title = () => (
  <>
    <Code className="w-5 h-5" />
    Configure Executor Function
  </>
);

ExecutorEditorView.Title = Title;
