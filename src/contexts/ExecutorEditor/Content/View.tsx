import {
  Play,
  AlertTriangle,
  Zap,
  Code,
  ArrowUp,
  ArrowDown,
  X,
  Edit,
  ArrowLeft,
} from "lucide-react";
import type { ExecutionConfig } from "@/types/workflow";
import type { WorkflowNodeType, WorkflowNode } from "@/types/nodes";
import { inferType, stringifyForDisplay } from "@/utils/workflow";
import Button from "@/components/ui/Button";

type ExecutorEditorViewProps = {
  isInternalNode?: boolean;
  meta: ExecutionConfig["nodeData"];
  nodeType: WorkflowNodeType;
  code: string;
  isAsync: boolean;
  error: string | null;
  inputData: string;
  outputData: string | null;
  internalNodes?: WorkflowNode[];

  onCodeChange: (code: string) => void;
  onInputDataChange: (input: string) => void;
  onTest: () => Promise<void>;
  onSave: () => void;
  onClose?: () => void;

  // For group nodes
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemoveNode?: (nodeId: string) => void;
  openInternalNode?: (node: WorkflowNode) => void;
  openInternalNodePropertiesPanel?: (node: WorkflowNode) => void;
};

/**
 * Format unknown type value for display in UI
 */

export default function ExecutorEditorView({
  isInternalNode = false,
  meta,
  nodeType,
  code,
  isAsync,
  error,
  inputData,
  outputData,
  internalNodes,

  onCodeChange,
  onInputDataChange,
  onTest,
  onSave,
  onClose,
  onReorder,
  openInternalNodePropertiesPanel,
  openInternalNode,
  onRemoveNode,
}: ExecutorEditorViewProps) {
  return (
    <>
      {/* Content */}
      <div
        className={`flex-1 overflow-y-auto px-6 ${nodeType === "group" ? "pt-6" : ""}`}
      >
        {/* Internal Nodes Management (Group nodes only, not shown when editing internal node) */}
        {nodeType === "group" && internalNodes && (
          <section>
            <h3 className="text-lg font-medium mb-3">
              Internal Nodes ({internalNodes.length})
            </h3>
            <div className="space-y-2 border rounded-lg p-3 bg-gray-50 max-h-[200px] overflow-y-auto">
              {internalNodes.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No internal nodes
                </p>
              ) : (
                internalNodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded border border-gray-200"
                  >
                    <span className="text-xs text-gray-400 font-mono w-6">
                      {index + 1}.
                    </span>

                    <div className="text-sm font-medium flex-1 truncate">
                      <Button
                        size="sm"
                        variant="text"
                        palette="primary"
                        onClick={() => openInternalNodePropertiesPanel?.(node)}
                      >
                        {node.data?.title || node.type}
                      </Button>
                    </div>
                    <span className="text-xs text-gray-400 uppercase px-2 py-0.5 bg-gray-100 rounded">
                      {node.type}
                    </span>

                    {/* Edit button */}
                    <button
                      onClick={() => openInternalNode?.(node)}
                      className="p-1 hover:bg-blue-100 rounded"
                      title="Edit internal node"
                    >
                      <Edit className="w-3 h-3 text-blue-600" />
                    </button>

                    {/* Reorder buttons */}
                    <button
                      onClick={() => onReorder?.(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="p-1 hover:bg-blue-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3 text-blue-600" />
                    </button>
                    <button
                      onClick={() =>
                        onReorder?.(
                          index,
                          Math.min(internalNodes.length - 1, index + 1),
                        )
                      }
                      disabled={index === internalNodes.length - 1}
                      className="p-1 hover:bg-blue-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3 text-blue-600" />
                    </button>

                    {/* Remove button */}
                    <button
                      onClick={() => onRemoveNode?.(node.id)}
                      className="p-1 hover:bg-red-100 rounded"
                      title="Remove from group"
                    >
                      <X className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Code Editor + Test Panel */}
        <section className="flex h-full">
          {/* Editor */}
          <div className="flex-1 flex flex-col py-6 pr-6 border-r">
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

            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1.5">
              <div className="text-gray-700">
                <span className="font-semibold">Input Type:</span>{" "}
                <code className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                  {meta
                    ? inferType(stringifyForDisplay(meta.inputData))
                    : "null"}
                </code>
              </div>
              <div className="text-gray-700">
                <span className="font-semibold">Output Type:</span>{" "}
                <code className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                  {meta ? inferType(meta.outputData) : "null"}
                </code>
              </div>
            </div>

            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder={
                nodeType === "decision"
                  ? `// Decision evaluator - return structured output\n// Example:\nconst isValid = inputData && inputData.isValid === true;\n\nreturn {\n  outputData: { ...inputData, checked: true },\n  success: isValid  // true = Yes, false = No\n};`
                  : nodeType === "task"
                    ? `// Task function (SYNC ONLY - no await/async)\n// Receives: inputData, fetch\n// Returns: transformed data\n\nreturn { ...inputData };`
                    : nodeType === "group"
                      ? `// Optional: Override default group execution\n// Default: Sequential execution of internal nodes\n// Receives: inputData, fetch\n// Returns: outputData\n\nreturn outputData;`
                      : meta
                        ? `// Receives: inputData (${stringifyForDisplay(meta.inputData)})\n// Returns: ${stringifyForDisplay(meta.outputData)}\n\nreturn outputData;`
                        : `// Your function code here\n// Receives: inputData, fetch\n// Return: output data\n\nreturn inputData;`
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
          <div className="w-80 flex flex-col py-6 pl-6">
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
        </section>
      </div>

      {/* Footer - only for Modal context */}

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
        {isInternalNode ? (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Group
          </button>
        ) : (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            Cancel
          </button>
        )}
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
