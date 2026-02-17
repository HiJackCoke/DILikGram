/**
 * Test Cases Tab for ExecutorEditor
 *
 * Allows users to create and run test cases for node validation.
 * Expected output is auto-generated from inputData on run.
 * Validates that the output type matches the Code Editor's reference output type.
 */

import {
  Play,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import type { TestCase } from "@/types/prd";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import Button from "@/components/ui/Button";

interface TestCasesTabProps {
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
  onRunTest: (testCase: TestCase) => Promise<void>;
  onRunAllTests: () => Promise<void>;
}

// ============================================================
// TestCaseItem — manages local string state for inputData JSON
// so the textarea stays editable while typing partial JSON.
// Persists to parent only on blur when JSON is valid.
// ============================================================

interface TestCaseItemProps {
  testCase: TestCase;
  isRunning: boolean;
  onUpdate: (id: string, updates: Partial<TestCase>) => void;
  onDelete: (id: string) => void;
  onRun: (testCase: TestCase) => void;
}

function TestCaseItem({
  testCase,
  isRunning,
  onUpdate,
  onDelete,
  onRun,
}: TestCaseItemProps) {
  const [localInputData, setLocalInputData] = useState(() =>
    JSON.stringify(testCase.inputData, null, 2),
  );
  const [inputDataError, setInputDataError] = useState(false);

  const handleInputDataBlur = () => {
    try {
      const parsed = JSON.parse(localInputData);
      setInputDataError(false);
      onUpdate(testCase.id, { inputData: parsed });
    } catch {
      setInputDataError(true);
    }
  };

  const hasOutput =
    testCase.expectedOutput !== null &&
    testCase.expectedOutput !== undefined &&
    !(
      typeof testCase.expectedOutput === "object" &&
      Object.keys(testCase.expectedOutput as object).length === 0
    );

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <input
          value={testCase.name}
          onChange={(e) => onUpdate(testCase.id, { name: e.target.value })}
          className="font-medium text-lg border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none flex-1 mr-2"
          placeholder="Test name"
        />

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {testCase.status === "passed" && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Passed</span>
            </div>
          )}
          {testCase.status === "failed" && (
            <div className="flex items-center gap-1 text-red-600">
              <XCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Failed</span>
            </div>
          )}
          {isRunning && (
            <div className="flex items-center gap-1 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Running</span>
            </div>
          )}

          {/* Actions */}
          <Button
            palette="success"
            variant="ghost"
            icon={<Play className="text-green-600" />}
            disabled={isRunning}
            onClick={() => onRun(testCase)}
          />
          <Button
            palette="danger"
            variant="ghost"
            icon={<Trash2 className="text-red-600" />}
            onClick={() => onDelete(testCase.id)}
          />
        </div>
      </div>

      <textarea
        value={testCase.description}
        onChange={(e) => onUpdate(testCase.id, { description: e.target.value })}
        placeholder="Test description"
        className="w-full p-2 text-sm border rounded mb-2 resize-none"
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Input Data */}
        <div>
          <label className="text-xs font-medium text-gray-600">
            Input Data (JSON)
          </label>
          <textarea
            value={localInputData}
            onChange={(e) => setLocalInputData(e.target.value)}
            onBlur={handleInputDataBlur}
            className={`w-full p-2 font-mono text-xs border rounded mt-1 resize-none ${
              inputDataError ? "border-red-400 bg-red-50" : "border-gray-300"
            }`}
            rows={4}
            spellCheck={false}
          />
          {inputDataError && (
            <p className="text-xs text-red-500 mt-0.5">Invalid JSON</p>
          )}
        </div>

        {/* Actual Output (auto-generated on run) */}
        <div>
          <label className="text-xs font-medium text-gray-600">
            Actual Output (auto-generated)
          </label>
          <div
            className={`w-full p-2 font-mono text-xs border rounded mt-1 min-h-[96px] bg-gray-50 whitespace-pre-wrap ${
              testCase.status === "failed"
                ? "border-red-300"
                : "border-gray-300"
            }`}
          >
            {hasOutput ? (
              JSON.stringify(testCase.expectedOutput, null, 2)
            ) : (
              <span className="text-gray-400">
                Run to auto-generate from inputData
              </span>
            )}
          </div>
        </div>
      </div>

      {testCase.error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <p className="font-medium">Error:</p>
          <p className="font-mono text-xs mt-1 whitespace-pre-wrap">
            {testCase.error}
          </p>
        </div>
      )}

      {testCase.lastRun && (
        <div className="mt-2 text-xs text-gray-500">
          Last run: {new Date(testCase.lastRun).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TestCasesTab
// ============================================================

export default function TestCasesTab({
  testCases,
  onTestCasesChange,
  onRunTest,
  onRunAllTests,
}: TestCasesTabProps) {
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const addTestCase = () => {
    const newCase: TestCase = {
      id: `test-${uuid()}`,
      name: "New Test",
      description: "",
      inputData: {},
      expectedOutput: {},
      status: "pending",
    };
    onTestCasesChange([...testCases, newCase]);
  };

  const updateTestCase = (id: string, updates: Partial<TestCase>) => {
    onTestCasesChange(
      testCases.map((tc) => (tc.id === id ? { ...tc, ...updates } : tc)),
    );
  };

  const deleteTestCase = (id: string) => {
    onTestCasesChange(testCases.filter((tc) => tc.id !== id));
  };

  const handleRunTest = async (testCase: TestCase) => {
    setRunningTestId(testCase.id);
    try {
      await onRunTest(testCase);
    } finally {
      setRunningTestId(null);
    }
  };

  const handleRunAllTests = async () => {
    setRunningAll(true);
    try {
      await onRunAllTests();
    } finally {
      setRunningAll(false);
    }
  };

  const passedCount = testCases.filter((tc) => tc.status === "passed").length;
  const failedCount = testCases.filter((tc) => tc.status === "failed").length;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Test Cases</h3>
          {testCases.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {passedCount} passed, {failedCount} failed, {testCases.length}{" "}
              total
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            palette="success"
            icon={runningAll ? <Loader2 className="animate-spin" /> : <Play />}
            disabled={testCases.length === 0 || runningAll}
            onClick={handleRunAllTests}
          >
            {runningAll ? "Running..." : "Run All"}
          </Button>

          <Button palette="primary" icon={<Plus />} onClick={addTestCase}>
            Add Test
          </Button>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        {testCases.map((testCase) => (
          <TestCaseItem
            key={testCase.id}
            testCase={testCase}
            isRunning={runningTestId === testCase.id}
            onUpdate={updateTestCase}
            onDelete={deleteTestCase}
            onRun={handleRunTest}
          />
        ))}
      </div>

      {testCases.length === 0 && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg">
          <p className="text-lg mb-2">No test cases yet</p>
          <p className="text-sm">
            Click "Add Test" to create your first test case
          </p>
        </div>
      )}
    </div>
  );
}
