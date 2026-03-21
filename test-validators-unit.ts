/**
 * Deterministic unit tests for validator bug fixes
 * Usage: npx tsx --tsconfig tsconfig.json test-validators-unit.ts
 *
 * These tests do NOT call OpenAI — they verify deterministic logic only.
 */

import { validateServiceNodeRuntime } from "@/contexts/WorkflowGenerator/validators/serviceNodeRuntime";
import {
  deterministicRepairPipelineStrategyA,
  validateGroupNodePipelines,
  hasDataFlowOverlap,
} from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";
import { validateEmptyDataShape } from "@/contexts/WorkflowGenerator/validators/emptyDataShape";
import {
  validateOutputDataTypeMismatch,
  deterministicRepairOutputDataTypeMismatch,
} from "@/contexts/WorkflowGenerator/validators/outputDataTypeMismatch";
import { deterministicRepairEmptyDataShape } from "@/contexts/WorkflowGenerator/utils/validationUtils";
import type { WorkflowNode } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function makeServiceNode(overrides: {
  id?: string;
  parentNode?: string;
  functionCode?: string;
  inputData?: unknown;
  outputData?: unknown;
  http?: Record<string, unknown>;
}): WorkflowNode {
  const {
    id = "test-service",
    parentNode,
    functionCode = 'const headers = {}\nconst endpoint = "/api/test"\nconst method = "GET"\ntry {\n  const response = await fetch(endpoint, { method, headers })\n  return await response.json()\n} catch (error) {\n  throw new Error(`API Request Failed: ${(error as Error).message}`)\n}',
    inputData = null,
    outputData = undefined,
    http = { method: "GET", endpoint: "/api/test", headers: {}, body: {} },
  } = overrides;
  return {
    id,
    type: "service",
    parentNode,
    position: { x: 0, y: 0 },
    data: {
      title: "Test Service",
      serviceType: "api",
      mode: "panel",
      http,
      execution: {
        config: {
          functionCode,
          nodeData: {
            inputData,
            outputData,
          },
          lastModified: Date.now(),
        },
      },
    },
  } as WorkflowNode;
}

function makeTaskNode(overrides: {
  id?: string;
  parentNode?: string;
  functionCode?: string;
  inputData?: unknown;
  outputData?: unknown;
  y?: number;
}): WorkflowNode {
  const {
    id = "test-task",
    parentNode,
    functionCode = "return inputData;",
    inputData = null,
    outputData = null,
    y = 0,
  } = overrides;
  return {
    id,
    type: "task",
    parentNode,
    position: { x: 0, y },
    data: {
      title: "Test Task",
      description: "",
      assignee: "",
      estimatedTime: 0,
      metadata: {},
      execution: {
        config: {
          functionCode,
          nodeData: { inputData, outputData },
          lastModified: Date.now(),
        },
      },
    },
  } as WorkflowNode;
}

function makeGroupNode(overrides: {
  id?: string;
  parentNode?: string;
  inputData?: unknown;
  outputData?: unknown;
}): WorkflowNode {
  const { id = "test-group", parentNode, inputData = null, outputData = null } = overrides;
  return {
    id,
    type: "group",
    parentNode,
    position: { x: 0, y: 0 },
    data: {
      title: "Test Group",
      description: "",
      groups: [],
      execution: {
        config: {
          functionCode: "return inputData;",
          nodeData: { inputData, outputData },
          lastModified: Date.now(),
        },
      },
    },
  } as WorkflowNode;
}

// ── Test Suite ────────────────────────────────────────────────────────────────

console.log("\n🧪 Unit Tests: Validator Bug Fixes");
console.log("=".repeat(60));

// ── Bug Fix #1: validateServiceNodeRuntime skips null outputData ───────────

console.log("\n📋 Bug #1: validateServiceNodeRuntime should skip null outputData");

async function testRuntimeSkipsNullOutputData() {
  // A service node with null outputData should NOT be flagged by runtime validator
  const node = makeServiceNode({
    id: "svc-null-output",
    outputData: null,
    inputData: { taskId: "task-123" },
  });

  const result = await validateServiceNodeRuntime([node]);
  assert(result.valid, "Service node with null outputData is skipped by runtime validator");
}

async function testRuntimeSkipsUndefinedOutputData() {
  // A service node with undefined outputData should NOT be flagged
  const node = makeServiceNode({
    id: "svc-undef-output",
    outputData: undefined,
    inputData: { taskId: "task-123" },
  });

  const result = await validateServiceNodeRuntime([node]);
  assert(result.valid, "Service node with undefined outputData is skipped by runtime validator");
}

async function testRuntimeValidatesNonNullOutputData() {
  // A service node with valid outputData AND functionCode that returns matching keys → valid
  const outputData = { status: "ok", data: "test" };
  // Use plain JS (no TypeScript syntax) since the sandbox runs raw JS via AsyncFunction
  const functionCode = [
    'const headers = { "Content-Type": "application/json" }',
    'const endpoint = "/api/test"',
    'const method = "GET"',
    "try {",
    "  const response = await fetch(endpoint, { method, headers })",
    "  if (!response.ok) throw new Error('HTTP Error: ' + response.status)",
    "  return await response.json()",
    "} catch (error) {",
    '  throw new Error("API Request Failed: " + error.message)',
    "}",
  ].join("\n");

  const node = makeServiceNode({
    id: "svc-valid-output",
    outputData,
    inputData: { param: "value" },
    functionCode,
  });

  const result = await validateServiceNodeRuntime([node]);
  // The mock fetch returns outputData, so result = outputData, keys match → valid
  assert(result.valid, "Service node with valid outputData and correct functionCode passes runtime");
}

// ── Bug Fix #2: deterministicRepairPipelineStrategyA handles null nextInput ──

console.log("\n📋 Bug #2: Strategy C — fix chain break when service node has null inputData");

function testStrategyC_ServiceNodeWithNullInputData() {
  // Scenario: TaskNode → ServiceNode, service has null inputData but functionCode references inputData
  const groupId = "group-1";
  const prevNode = makeTaskNode({
    id: "task-prepare",
    parentNode: groupId,
    y: 100,
    functionCode: "return { taskId: 'abc-123' };",
    inputData: { userId: "user-1" },
    outputData: { taskId: "abc-123" },
  });

  const nextNode = makeServiceNode({
    id: "svc-delete",
    parentNode: groupId,
    inputData: null, // BUG: service node needs inputData from prevNode but has null
    outputData: { success: true },
    functionCode: [
      'const headers = { "Content-Type": "application/json" }',
      "const body = { taskId: inputData.taskId }", // references inputData!
      'const endpoint = "/api/tasks/delete"',
      'const method = "DELETE"',
      "try {",
      "  const response = await fetch(endpoint, { method, headers, body: JSON.stringify(body) })",
      "  return await response.json()",
      "} catch (error) {",
      '  throw new Error("Delete failed")',
      "}",
    ].join("\n"),
  });

  // Set y positions so service is after task
  (nextNode as WorkflowNode).position = { x: 0, y: 200 };

  const groupNode = makeGroupNode({
    id: groupId,
    inputData: { userId: "user-1" },
    outputData: { success: true },
  });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  // Verify the chain IS broken before repair
  const overlapBefore = hasDataFlowOverlap(prevNode, nextNode);
  assert(!overlapBefore, "Chain is broken before Strategy C (service has null inputData but functionCode references it)");

  // Apply deterministic repair
  const repaired = deterministicRepairPipelineStrategyA(nodes);

  const repairedService = repaired.find((n) => n.id === "svc-delete");
  const repairedInputData = (repairedService as WorkflowNode | undefined)?.data?.execution?.config?.nodeData?.inputData;

  assert(
    repairedInputData !== null && repairedInputData !== undefined,
    "Strategy C: service node inputData is no longer null after repair",
  );
  assert(
    typeof repairedInputData === "object" &&
      "taskId" in (repairedInputData as Record<string, unknown>),
    "Strategy C: service node inputData now has taskId from prevNode outputData",
  );
}

function testStrategyC_SelfContainedServiceNodeNotAffected() {
  // A self-contained service node (functionCode does NOT reference inputData) should NOT be changed
  const groupId = "group-2";
  const prevNode = makeTaskNode({
    id: "task-check",
    parentNode: groupId,
    y: 100,
    functionCode: "return { checked: true };",
    inputData: { userId: "user-1" },
    outputData: { checked: true },
  });

  const nextNode = makeServiceNode({
    id: "svc-fetch-all",
    parentNode: groupId,
    inputData: null, // self-contained service: doesn't need inputData
    outputData: { tasks: [{ id: "1" }, { id: "2" }, { id: "3" }] },
    functionCode: [
      'const headers = { "Content-Type": "application/json" }',
      'const endpoint = "/api/tasks"',
      'const method = "GET"',
      "try {",
      "  const response = await fetch(endpoint, { method, headers })", // NO inputData reference
      "  return await response.json()",
      "} catch (error) {",
      '  throw new Error("Fetch failed")',
      "}",
    ].join("\n"),
  });
  (nextNode as WorkflowNode).position = { x: 0, y: 200 };

  const groupNode = makeGroupNode({ id: groupId });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  // This chain break: prevNode outputs { checked: true } but nextNode has null inputData
  // BUT functionCode does NOT reference inputData → self-contained → hasDataFlowOverlap = true
  const overlap = hasDataFlowOverlap(prevNode, nextNode);
  assert(overlap, "Self-contained service node (no inputData in functionCode) is NOT a chain break");

  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedService = repaired.find((n) => n.id === "svc-fetch-all");
  const repairedInputData = (repairedService as WorkflowNode | undefined)?.data?.execution?.config?.nodeData?.inputData;

  assert(
    repairedInputData === null,
    "Strategy C: self-contained service node inputData stays null (not modified)",
  );
}

// ── Bug Fix #3: Strategy A still works correctly ──────────────────────────

console.log("\n📋 Bug #3: Strategy A still works (passthrough keys for task→task chains)");

function testStrategyA_PassthroughKeys() {
  const groupId = "group-3";
  const prevNode = makeTaskNode({
    id: "task-fetch",
    parentNode: groupId,
    y: 100,
    functionCode: "return { tasks: inputData.tasks };",
    inputData: { tasks: ["a", "b", "c"], energyScore: 75 },
    outputData: { tasks: ["a", "b", "c"] }, // Missing energyScore from nextNode's perspective
  });

  const nextNode = makeTaskNode({
    id: "task-display",
    parentNode: groupId,
    y: 200,
    functionCode: "return { displayedTasks: inputData.tasks, score: inputData.energyScore };",
    inputData: { tasks: ["a", "b", "c"], energyScore: 75 }, // needs energyScore
    outputData: { displayedTasks: ["a", "b", "c"], score: 75 },
  });

  const groupNode = makeGroupNode({ id: groupId });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  // Verify chain IS broken
  const overlapBefore = hasDataFlowOverlap(prevNode, nextNode);
  assert(!overlapBefore, "Chain is broken before Strategy A (prevNode missing energyScore in output)");

  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedPrev = repaired.find((n) => n.id === "task-fetch");
  const repairedOutputData = (repairedPrev as WorkflowNode | undefined)?.data?.execution?.config?.nodeData?.outputData;

  assert(
    repairedOutputData !== null &&
      typeof repairedOutputData === "object" &&
      "energyScore" in (repairedOutputData as Record<string, unknown>),
    "Strategy A: prevNode outputData now includes passthrough energyScore key",
  );
}

// ── Bug Fix #4: validateGroupNodePipelines chain break detection ──────────

console.log("\n📋 Bug #4: validateGroupNodePipelines regression check");

async function testGroupNodePipelineDetectsChainBreak() {
  const groupId = "group-4";
  // Group inputData must match firstChild.inputData exactly (input_boundary rule)
  // firstChild (task-prepare-4) has inputData = { taskId: "task-123" }
  // so group.inputData must also be { taskId: "task-123" }
  const groupNode = makeGroupNode({
    id: groupId,
    inputData: { taskId: "task-123" },
    outputData: { success: true },
  });

  const prevNode = makeTaskNode({
    id: "task-prepare-4",
    parentNode: groupId,
    y: 100,
    functionCode: "return { taskId: inputData.taskId };",
    inputData: { taskId: "task-123" }, // matches group.inputData → no boundary violation
    outputData: { taskId: "task-123" },
  });

  const nextNode = makeServiceNode({
    id: "svc-delete-4",
    parentNode: groupId,
    inputData: null, // null inputData + functionCode references inputData → chain break
    outputData: { success: true },
    functionCode: "const body = { taskId: inputData.taskId }\nreturn await fetch('/api', { method: 'DELETE', body: JSON.stringify(body) }).then(r => r.json())",
  });
  (nextNode as WorkflowNode).position = { x: 0, y: 200 };

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  const result = await validateGroupNodePipelines(nodes);
  assert(!result.valid, "GroupNode pipeline validator detects chain break with null-inputData service node");

  // After Strategy C repair, should pass
  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const resultAfterRepair = await validateGroupNodePipelines(repaired);
  assert(resultAfterRepair.valid, "GroupNode pipeline validator passes after Strategy C repair");
}

// ── Regression #5: deterministicRepairEmptyDataShape Strategy A ───────────
//    (Empty array in inputData — filled from parent or removed if spurious)

console.log("\n📋 Regression #5: deterministicRepairEmptyDataShape — Strategy A");

function testStrategyA_FillEmptyInputFromParent() {
  // Parent outputs { tasks: [t1,t2,t3] }. Child inputData has { tasks: [] }.
  // Strategy A Case 1: fill child.inputData.tasks from parent.outputData.tasks
  const tasks = [
    { id: "t1", content: "Buy milk", completed: false },
    { id: "t2", content: "Write code", completed: true },
    { id: "t3", content: "Exercise", completed: false },
  ];
  const parentNode = makeTaskNode({
    id: "task-root",
    functionCode: "return { tasks: [...] };",
    inputData: null,
    outputData: { tasks },
  });
  const childNode = makeTaskNode({
    id: "task-display",
    parentNode: "task-root",
    functionCode: "return { displayedTasks: inputData.tasks };",
    inputData: { tasks: [] }, // empty array — should be filled from parent
    outputData: { displayedTasks: [] },
  });

  // Verify validator catches it
  const before = validateEmptyDataShape([parentNode, childNode]);
  assert(!before.valid, "Strategy A (Case 1): empty inputData.tasks triggers EMPTY_DATA_SHAPE violation");

  // Repair and verify
  const repaired = deterministicRepairEmptyDataShape([parentNode, childNode]);
  const repairedChild = repaired.find((n) => n.id === "task-display");
  const repairedInput = repairedChild?.data?.execution?.config?.nodeData?.inputData as Record<string, unknown> | null | undefined;
  assert(
    Array.isArray(repairedInput?.tasks) && (repairedInput.tasks as unknown[]).length >= 3,
    "Strategy A (Case 1): inputData.tasks filled from parent outputData (3+ items)",
  );
}

function testStrategyA_RemoveSpuriousInputKey() {
  // Parent outputs { userId: "u1" }. Child inputData has { userId: "u1", tasks: [] }.
  // tasks is NOT in parent output and NOT in functionCode → spurious → delete it
  const parentNode = makeTaskNode({
    id: "task-root-2",
    functionCode: "return { userId: 'u1' };",
    inputData: null,
    outputData: { userId: "u1" },
  });
  const childNode = makeTaskNode({
    id: "task-process-2",
    parentNode: "task-root-2",
    functionCode: "return { processed: inputData.userId };", // only uses userId, not tasks
    inputData: { userId: "u1", tasks: [] }, // tasks is spurious
    outputData: { processed: "u1" },
  });

  const repaired = deterministicRepairEmptyDataShape([parentNode, childNode]);
  const repairedChild = repaired.find((n) => n.id === "task-process-2");
  const repairedInput = repairedChild?.data?.execution?.config?.nodeData?.inputData as Record<string, unknown> | null | undefined;
  assert(
    repairedInput !== null && !("tasks" in (repairedInput ?? {})),
    "Strategy A (Case 2): spurious inputData.tasks key removed (not in parent output, not in functionCode)",
  );
  assert(
    repairedInput !== null && "userId" in (repairedInput ?? {}),
    "Strategy A (Case 2): userId key preserved after spurious key removal",
  );
}

// ── Regression #6: deterministicRepairEmptyDataShape Strategy B ───────────
//    (Empty array in outputData — filled from inputData via same-key or functionCode pattern)

console.log("\n📋 Regression #6: deterministicRepairEmptyDataShape — Strategy B");

function testStrategyB1_SameKeyPassthrough() {
  // outputData.tasks = [] but inputData.tasks = [t1,t2,t3] → B1: copy same-key
  const tasks = [
    { id: "t1", content: "Buy milk", completed: false },
    { id: "t2", content: "Write code", completed: true },
    { id: "t3", content: "Exercise", completed: false },
  ];
  const node = makeTaskNode({
    id: "task-b1",
    functionCode: "return { tasks: inputData.tasks };",
    inputData: { tasks },
    outputData: { tasks: [] }, // same-key empty — should be filled from inputData
  });

  const before = validateEmptyDataShape([node]);
  assert(!before.valid, "Strategy B1: empty outputData.tasks triggers EMPTY_DATA_SHAPE violation");

  const repaired = deterministicRepairEmptyDataShape([node]);
  const repairedNode = repaired.find((n) => n.id === "task-b1");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData?.outputData as Record<string, unknown> | null | undefined;
  assert(
    Array.isArray(repairedOutput?.tasks) && (repairedOutput.tasks as unknown[]).length >= 3,
    "Strategy B1: outputData.tasks filled from same-key inputData.tasks (3+ items)",
  );

  const after = validateEmptyDataShape(repaired);
  assert(after.valid, "Strategy B1: EMPTY_DATA_SHAPE violation resolved after deterministic repair");
}

function testStrategyB2_FunctionCodePatternMatch() {
  // outputData.displayedTasks = [] and functionCode has `displayedTasks: inputData.tasks`
  // inputData.tasks has 3+ items → B2: fill outputData.displayedTasks from inputData.tasks
  const tasks = [
    { id: "t1", content: "Buy milk", completed: false },
    { id: "t2", content: "Write code", completed: true },
    { id: "t3", content: "Exercise", completed: false },
  ];
  const node = makeTaskNode({
    id: "task-b2",
    functionCode: "return { displayedTasks: inputData.tasks };",
    inputData: { tasks },
    outputData: { displayedTasks: [] }, // different key, filled via pattern match
  });

  const repaired = deterministicRepairEmptyDataShape([node]);
  const repairedNode = repaired.find((n) => n.id === "task-b2");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData?.outputData as Record<string, unknown> | null | undefined;
  assert(
    Array.isArray(repairedOutput?.displayedTasks) && (repairedOutput.displayedTasks as unknown[]).length >= 3,
    "Strategy B2: outputData.displayedTasks filled from inputData.tasks via functionCode pattern (3+ items)",
  );

  const after = validateEmptyDataShape(repaired);
  assert(after.valid, "Strategy B2: EMPTY_DATA_SHAPE violation resolved via functionCode pattern match");
}

// ── Regression #7: deterministicRepairOutputDataTypeMismatch ─────────────────
//    (functionCode returns different keys than declared outputData — fix outputData deterministically)

console.log("\n📋 Regression #7: deterministicRepairOutputDataTypeMismatch");

async function testOutputDataTypeMismatch_KeyMismatch() {
  // functionCode returns { displayedTasks: [...] } but outputData declares { tasks: [...] }
  const tasks = [
    { id: "t1", content: "Buy milk", completed: false },
    { id: "t2", content: "Write code", completed: true },
    { id: "t3", content: "Exercise", completed: false },
  ];
  const node = makeTaskNode({
    id: "task-mismatch",
    functionCode: "return { displayedTasks: inputData.tasks };",
    inputData: { tasks },
    outputData: { tasks }, // wrong key declared — should be displayedTasks
  });

  // Verify validator catches it
  const before = await validateOutputDataTypeMismatch([node]);
  assert(!before.valid, "outputData Type Mismatch: key mismatch (tasks vs displayedTasks) detected");

  // Deterministic repair
  const repaired = await deterministicRepairOutputDataTypeMismatch([node]);
  const repairedNode = repaired.find((n) => n.id === "task-mismatch");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData?.outputData as Record<string, unknown> | null | undefined;

  assert(
    repairedOutput !== null &&
    "displayedTasks" in (repairedOutput ?? {}) &&
    !("tasks" in (repairedOutput ?? {})),
    "Repair: outputData updated to { displayedTasks } (matches actual functionCode return)",
  );

  const after = await validateOutputDataTypeMismatch(repaired);
  assert(after.valid, "Repair: outputData Type Mismatch resolved after deterministic repair");
}

async function testOutputDataTypeMismatch_TypeMismatch() {
  // functionCode returns { count: 5 } (number) but outputData declares { count: "five" } (string)
  // typeShapeMatches: getDataType(5)="number" vs getDataType("five")="string" → mismatch
  const node = makeTaskNode({
    id: "task-type-mismatch",
    functionCode: "return { count: inputData.tasks.length };",
    inputData: {
      tasks: [
        { id: "t1", content: "Buy milk", completed: false },
        { id: "t2", content: "Write code", completed: true },
        { id: "t3", content: "Exercise", completed: false },
      ],
    },
    outputData: { count: "five" }, // wrong type: string vs actual number
  });

  const before = await validateOutputDataTypeMismatch([node]);
  assert(!before.valid, "outputData Type Mismatch: type mismatch (number vs string) detected");

  const repaired = await deterministicRepairOutputDataTypeMismatch([node]);
  const repairedNode = repaired.find((n) => n.id === "task-type-mismatch");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData?.outputData as Record<string, unknown> | null | undefined;

  assert(
    repairedOutput !== null &&
    "count" in (repairedOutput ?? {}) &&
    typeof repairedOutput?.count === "number",
    "Repair: outputData.count updated to number type (matches actual functionCode return)",
  );

  const after = await validateOutputDataTypeMismatch(repaired);
  assert(after.valid, "Repair: outputData Type Mismatch resolved (type now matches actual)");
}

// ── Run all tests ─────────────────────────────────────────────────────────────

async function runAllTests(): Promise<void> {
  console.log("");
  await testRuntimeSkipsNullOutputData();
  await testRuntimeSkipsUndefinedOutputData();
  await testRuntimeValidatesNonNullOutputData();

  console.log("");
  testStrategyC_ServiceNodeWithNullInputData();
  testStrategyC_SelfContainedServiceNodeNotAffected();

  console.log("");
  testStrategyA_PassthroughKeys();

  console.log("");
  await testGroupNodePipelineDetectsChainBreak();

  console.log("");
  testStrategyA_FillEmptyInputFromParent();
  testStrategyA_RemoveSpuriousInputKey();

  console.log("");
  testStrategyB1_SameKeyPassthrough();
  testStrategyB2_FunctionCodePatternMatch();

  console.log("");
  await testOutputDataTypeMismatch_KeyMismatch();
  await testOutputDataTypeMismatch_TypeMismatch();

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All ${passed} tests passed!`);
  }
  console.log("=".repeat(60));
}

runAllTests().catch((e: Error) => {
  console.error("\n💥 Test runner error:", e.message);
  console.error(e.stack);
  process.exit(1);
});
