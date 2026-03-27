import { useState } from "react";
import { Play, AlertTriangle, Zap, Code } from "lucide-react";

import { inferType } from "@/utils/workflow";
import Button from "@/components/ui/Button";
import CodeEditor from "@/components/ui/CodeEditor";
import TestCasesTab from "./TestCasesTab";

import GroupDataFlow from "./GroupDataFlow";

import { ExecutorEditorContentViewProps } from "./type";

/**
 * Format unknown type value for display in UI
 */

export default function ExecutorEditorContentView({
  isVisibleTypeHint = true,
  isVisibleTestExecutor = true,
  meta,
  nodeType,
  code,
  isAsync,
  error,
  inputData,
  outputData,
  internalNodes,
  testCases,

  onCodeChange,
  onInputDataChange,
  onRunCode,
  onSave,
  onClose,
  onTestCasesChange,
  onRunTest,
  onRunAllTests,
  onReorder,
  onInternalNodePropertiesSave,

  onInternalNodeConfigSave,
  onRemove,
}: ExecutorEditorContentViewProps) {
  const [activeTab, setActiveTab] = useState<"code" | "tests">("code");

  return (
    <>
      {/* Tab Headers */}
      <div className="border-b px-6 pt-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("code")}
            className={`pb-2 px-1 border-b-2 transition font-medium ${
              activeTab === "code"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Code Editor
          </button>
          <button
            onClick={() => setActiveTab("tests")}
            className={`pb-2 px-1 border-b-2 transition font-medium ${
              activeTab === "tests"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Test Cases
            {testCases.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                {testCases.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div
        className={`flex-1 overflow-y-scroll ${activeTab === "code" ? "px-6" : ""} ${nodeType === "group" && activeTab === "code" ? "pt-6" : ""}`}
      >
        {/* Code Tab Content */}
        {activeTab === "code" && (
          <>
            {/* Code Editor + Test Panel */}
            <section className="flex min-h-full">
              {/* Editor */}
              <div
                className={`flex-1 flex flex-col py-6 ${isVisibleTestExecutor ? "border-r pr-6" : ""} `}
              >
                {/* Type Hints - always shown */}
                {isVisibleTypeHint && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1.5">
                    <div className="text-gray-700">
                      <span className="font-semibold">Input Type:</span>{" "}
                      <code className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                        {meta?.inputData
                          ? inferType(meta.inputData)
                          : "undefined"}
                      </code>
                    </div>
                    <div className="text-gray-700">
                      <span className="font-semibold">Output Type:</span>{" "}
                      <code className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                        {meta?.outputData
                          ? inferType(meta.outputData)
                          : "undefined"}
                      </code>
                    </div>
                  </div>
                )}
                {nodeType === "group" ? (
                  <GroupDataFlow
                    internalNodes={internalNodes}
                    rootInputData={meta?.inputData}
                    onReorder={onReorder}
                    onRemove={onRemove}
                    onInternalNodePropertiesSave={onInternalNodePropertiesSave}
                    onInternalNodeConfigSave={onInternalNodeConfigSave}
                  />
                ) : (
                  <>
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
                          <span>
                            TaskNode must be sync - use ServiceNode instead
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col rounded-lg overflow-hidden border border-[#3c3c3c]">
                      {/* Function signature — decorative, matches vs-dark theme */}
                      <div className="px-4 py-2 bg-[#1e1e1e] text-[#6a9955] border-b border-[#3c3c3c] select-none text-xs font-mono leading-relaxed">
                        {nodeType === "service"
                          ? "async function(inputData, fetch) {"
                          : "function(inputData) {"}
                      </div>
                      <CodeEditor
                        value={code}
                        language="javascript"
                        onChange={onCodeChange}
                        className="w-full min-h-[200px]"
                      />
                      {/* Closing brace — decorative */}
                      <div className="px-4 py-2 bg-[#1e1e1e] text-[#6a9955] border-t border-[#3c3c3c] select-none text-xs font-mono leading-relaxed">
                        {"}"}
                      </div>
                    </div>

                    {error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">
                            Compilation Error
                          </p>
                          <p className="text-xs text-red-600 mt-1 font-mono">
                            {error}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!isVisibleTestExecutor && activeTab === "code" && (
                  <div className="mt-6">
                    <Button
                      fullWidth
                      palette="success"
                      icon={<Play />}
                      disabled={!!error}
                      onClick={onRunCode}
                    >
                      Run Test
                    </Button>
                  </div>
                )}
              </div>

              {/* Test Panel */}
              {isVisibleTestExecutor && (
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

                  <Button
                    palette="success"
                    icon={<Play />}
                    disabled={!!error}
                    onClick={onRunCode}
                  >
                    Run Test
                  </Button>

                  {outputData && (
                    <>
                      <label className="text-xs text-gray-600 mt-3 mb-2">
                        Output Data (JSON)
                      </label>
                      <div className="flex-1 p-3 font-mono text-xs bg-gray-50 border rounded-lg overflow-auto">
                        <pre className="whitespace-pre-wrap">{outputData}</pre>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* Test Cases Tab Content */}
        {activeTab === "tests" && (
          <TestCasesTab
            testCases={testCases}
            onTestCasesChange={onTestCasesChange}
            onRunTest={onRunTest}
            onRunAllTests={onRunAllTests}
          />
        )}
      </div>

      {/* Footer - only for Modal context */}

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-lg">
        <Button palette="neutral" variant="ghost" onClick={onClose}>
          Cancel
        </Button>

        <Button
          palette="primary"
          disabled={nodeType !== "group" && (!!error || !code.trim())}
          onClick={onSave}
        >
          Save Function
        </Button>
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

ExecutorEditorContentView.Title = Title;
