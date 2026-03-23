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
import {
  deterministicRepairEmptyDataShape,
  deterministicRepairTrivialDecisionNodes,
  deterministicRepairFunctionCodeMismatch,
  deterministicRepairParentChildDataFlow,
  getExecutionConfig,
} from "@/contexts/WorkflowGenerator/utils/validationUtils";
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
  const {
    id = "test-group",
    parentNode,
    inputData = null,
    outputData = null,
  } = overrides;
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

console.log(
  "\n📋 Bug #1: validateServiceNodeRuntime should skip null outputData",
);

async function testRuntimeSkipsNullOutputData() {
  // A service node with null outputData should NOT be flagged by runtime validator
  const node = makeServiceNode({
    id: "svc-null-output",
    outputData: null,
    inputData: { taskId: "task-123" },
  });

  const result = await validateServiceNodeRuntime([node]);
  assert(
    result.valid,
    "Service node with null outputData is skipped by runtime validator",
  );
}

async function testRuntimeSkipsUndefinedOutputData() {
  // A service node with undefined outputData should NOT be flagged
  const node = makeServiceNode({
    id: "svc-undef-output",
    outputData: undefined,
    inputData: { taskId: "task-123" },
  });

  const result = await validateServiceNodeRuntime([node]);
  assert(
    result.valid,
    "Service node with undefined outputData is skipped by runtime validator",
  );
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
  assert(
    result.valid,
    "Service node with valid outputData and correct functionCode passes runtime",
  );
}

// ── Bug Fix #2: deterministicRepairPipelineStrategyA handles null nextInput ──

console.log(
  "\n📋 Bug #2: Strategy C — fix chain break when service node has null inputData",
);

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
  assert(
    !overlapBefore,
    "Chain is broken before Strategy C (service has null inputData but functionCode references it)",
  );

  // Apply deterministic repair
  const repaired = deterministicRepairPipelineStrategyA(nodes);

  const repairedService = repaired.find((n) => n.id === "svc-delete");
  const repairedInputData = (repairedService as WorkflowNode | undefined)?.data
    ?.execution?.config?.nodeData?.inputData;

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
  assert(
    overlap,
    "Self-contained service node (no inputData in functionCode) is NOT a chain break",
  );

  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedService = repaired.find((n) => n.id === "svc-fetch-all");
  const repairedInputData = (repairedService as WorkflowNode | undefined)?.data
    ?.execution?.config?.nodeData?.inputData;

  assert(
    repairedInputData === null,
    "Strategy C: self-contained service node inputData stays null (not modified)",
  );
}

// ── Bug Fix #3: Strategy A still works correctly ──────────────────────────

console.log(
  "\n📋 Bug #3: Strategy A still works (passthrough keys for task→task chains)",
);

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
    functionCode:
      "return { displayedTasks: inputData.tasks, score: inputData.energyScore };",
    inputData: { tasks: ["a", "b", "c"], energyScore: 75 }, // needs energyScore
    outputData: { displayedTasks: ["a", "b", "c"], score: 75 },
  });

  const groupNode = makeGroupNode({ id: groupId });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  // Verify chain IS broken
  const overlapBefore = hasDataFlowOverlap(prevNode, nextNode);
  assert(
    !overlapBefore,
    "Chain is broken before Strategy A (prevNode missing energyScore in output)",
  );

  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedPrev = repaired.find((n) => n.id === "task-fetch");
  const repairedOutputData = (repairedPrev as WorkflowNode | undefined)?.data
    ?.execution?.config?.nodeData?.outputData;

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
    functionCode:
      "const body = { taskId: inputData.taskId }\nreturn await fetch('/api', { method: 'DELETE', body: JSON.stringify(body) }).then(r => r.json())",
  });
  (nextNode as WorkflowNode).position = { x: 0, y: 200 };

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  const result = await validateGroupNodePipelines(nodes);
  assert(
    !result.valid,
    "GroupNode pipeline validator detects chain break with null-inputData service node",
  );

  // After Strategy C repair, should pass
  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const resultAfterRepair = await validateGroupNodePipelines(repaired);
  assert(
    resultAfterRepair.valid,
    "GroupNode pipeline validator passes after Strategy C repair",
  );
}

// ── Regression #5: deterministicRepairEmptyDataShape Strategy A ───────────
//    (Empty array in inputData — filled from parent or removed if spurious)

console.log(
  "\n📋 Regression #5: deterministicRepairEmptyDataShape — Strategy A",
);

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
  assert(
    !before.valid,
    "Strategy A (Case 1): empty inputData.tasks triggers EMPTY_DATA_SHAPE violation",
  );

  // Repair and verify
  const repaired = deterministicRepairEmptyDataShape([parentNode, childNode]);
  const repairedChild = repaired.find((n) => n.id === "task-display");
  const repairedInput = repairedChild?.data?.execution?.config?.nodeData
    ?.inputData as Record<string, unknown> | null | undefined;
  assert(
    Array.isArray(repairedInput?.tasks) &&
      (repairedInput.tasks as unknown[]).length >= 3,
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
  const repairedInput = repairedChild?.data?.execution?.config?.nodeData
    ?.inputData as Record<string, unknown> | null | undefined;
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

console.log(
  "\n📋 Regression #6: deterministicRepairEmptyDataShape — Strategy B",
);

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
  assert(
    !before.valid,
    "Strategy B1: empty outputData.tasks triggers EMPTY_DATA_SHAPE violation",
  );

  const repaired = deterministicRepairEmptyDataShape([node]);
  const repairedNode = repaired.find((n) => n.id === "task-b1");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData
    ?.outputData as Record<string, unknown> | null | undefined;
  assert(
    Array.isArray(repairedOutput?.tasks) &&
      (repairedOutput.tasks as unknown[]).length >= 3,
    "Strategy B1: outputData.tasks filled from same-key inputData.tasks (3+ items)",
  );

  const after = validateEmptyDataShape(repaired);
  assert(
    after.valid,
    "Strategy B1: EMPTY_DATA_SHAPE violation resolved after deterministic repair",
  );
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
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData
    ?.outputData as Record<string, unknown> | null | undefined;
  assert(
    Array.isArray(repairedOutput?.displayedTasks) &&
      (repairedOutput.displayedTasks as unknown[]).length >= 3,
    "Strategy B2: outputData.displayedTasks filled from inputData.tasks via functionCode pattern (3+ items)",
  );

  const after = validateEmptyDataShape(repaired);
  assert(
    after.valid,
    "Strategy B2: EMPTY_DATA_SHAPE violation resolved via functionCode pattern match",
  );
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
  assert(
    !before.valid,
    "outputData Type Mismatch: key mismatch (tasks vs displayedTasks) detected",
  );

  // Deterministic repair
  const repaired = await deterministicRepairOutputDataTypeMismatch([node]);
  const repairedNode = repaired.find((n) => n.id === "task-mismatch");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData
    ?.outputData as Record<string, unknown> | null | undefined;

  assert(
    repairedOutput !== null &&
      "displayedTasks" in (repairedOutput ?? {}) &&
      !("tasks" in (repairedOutput ?? {})),
    "Repair: outputData updated to { displayedTasks } (matches actual functionCode return)",
  );

  const after = await validateOutputDataTypeMismatch(repaired);
  assert(
    after.valid,
    "Repair: outputData Type Mismatch resolved after deterministic repair",
  );
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
  assert(
    !before.valid,
    "outputData Type Mismatch: type mismatch (number vs string) detected",
  );

  const repaired = await deterministicRepairOutputDataTypeMismatch([node]);
  const repairedNode = repaired.find((n) => n.id === "task-type-mismatch");
  const repairedOutput = repairedNode?.data?.execution?.config?.nodeData
    ?.outputData as Record<string, unknown> | null | undefined;

  assert(
    repairedOutput !== null &&
      "count" in (repairedOutput ?? {}) &&
      typeof repairedOutput?.count === "number",
    "Repair: outputData.count updated to number type (matches actual functionCode return)",
  );

  const after = await validateOutputDataTypeMismatch(repaired);
  assert(
    after.valid,
    "Repair: outputData Type Mismatch resolved (type now matches actual)",
  );
}

// ── Regression #8b: Deep nested empty array padding ──────────────────────────
//    When games[i].attendees=[] (nested deep), deterministicRepairEmptyDataShape
//    must pad them with placeholder items so validateEmptyDataShape passes.

console.log(
  "\n📋 Regression #8b: Deep nested empty array padding (games[i].attendees=[])",
);

function testDeepNestedEmptyArrayPadding() {
  const node = makeTaskNode({
    id: "task-create-game",
    inputData: {
      games: [
        { id: "g1", host: "user-001", attendees: [] },
        { id: "g2", host: "user-002", attendees: [] },
        { id: "g3", host: "user-003", attendees: [] },
      ],
      currentUser: "user-001",
    },
    outputData: { gameId: "g1", success: true },
  });

  const repaired = deterministicRepairEmptyDataShape([node]);
  const repairedNode = repaired[0];
  const inputData = repairedNode?.data?.execution?.config?.nodeData
    ?.inputData as Record<string, unknown> | null;
  const games = inputData?.games as Array<Record<string, unknown>> | undefined;

  assert(
    Array.isArray(games) && games.length >= 3,
    "Deep nested: games array still has 3+ elements after repair",
  );
  assert(
    games != null &&
      games.every(
        (g) =>
          Array.isArray(g.attendees) && (g.attendees as unknown[]).length >= 3,
      ),
    "Deep nested: attendees arrays inside game objects padded to 3+ items",
  );

  // Validate that the repaired node passes validateEmptyDataShape for attendees
  const afterRepair = validateEmptyDataShape(repaired);
  assert(
    afterRepair.valid ||
      !(afterRepair.errorMessage?.includes("attendees") ?? false),
    "Deep nested: validateEmptyDataShape no longer fails on attendees after repair",
  );
}

// ── Regression #8: Strategy C service node exemption ──────────────────────────
//    When service's functionCode references keys NOT in prevNode.outputData, Strategy C must skip.

console.log(
  "\n📋 Regression #8: Strategy C — service node exemption (mismatched http template vars)",
);

function testStrategyC_ServiceNodeExemption_MismatchedTemplateVars() {
  // Scenario: TaskNode outputs { meals: [...] } but ServiceNode's functionCode
  // references inputData.content and inputData.calories (from data.http template vars).
  // Strategy C should NOT override the service's inputData with { meals }.
  const groupId = "group-svc-exempt";
  const prevNode = makeTaskNode({
    id: "task-log-meal",
    parentNode: groupId,
    y: 100,
    functionCode: "return { meals: inputData.meals };",
    inputData: {
      meals: [
        { content: "Apple", calories: 95 },
        { content: "Banana", calories: 89 },
        { content: "Egg", calories: 78 },
      ],
    },
    outputData: {
      meals: [
        { content: "Apple", calories: 95 },
        { content: "Banana", calories: 89 },
        { content: "Egg", calories: 78 },
      ],
    },
  });

  const nextNode = makeServiceNode({
    id: "svc-save-meal",
    parentNode: groupId,
    inputData: null, // null inputData — Strategy C would normally fill this
    outputData: { success: true, mealId: "meal-001" },
    // functionCode references inputData.content and inputData.calories (from data.http template vars)
    functionCode: [
      'const headers = { "Content-Type": "application/json" }',
      "const body = { content: inputData.content, calories: inputData.calories }",
      'const endpoint = "/api/meals/save"',
      'const method = "POST"',
      "try {",
      "  const response = await fetch(endpoint, { method, headers, body: JSON.stringify(body) })",
      "  return await response.json()",
      "} catch (error) {",
      '  throw new Error("Save failed")',
      "}",
    ].join("\n"),
    http: {
      method: "POST",
      endpoint: "/api/meals/save",
      headers: {},
      body: {
        content: "{{inputData.content}}",
        calories: "{{inputData.calories}}",
      },
    },
  });
  (nextNode as WorkflowNode).position = { x: 0, y: 200 };

  const groupNode = makeGroupNode({
    id: groupId,
    inputData: {
      meals: [
        { content: "Apple", calories: 95 },
        { content: "Banana", calories: 89 },
        { content: "Egg", calories: 78 },
      ],
    },
    outputData: { success: true, mealId: "meal-001" },
  });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];

  // Apply deterministicRepairPipelineStrategyA
  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedService = repaired.find((n) => n.id === "svc-save-meal");
  const repairedInputData = (repairedService as WorkflowNode | undefined)?.data
    ?.execution?.config?.nodeData?.inputData;

  // Service node inputData should remain null (not overridden with { meals })
  // because its functionCode references { content, calories } which are NOT in prevNode.outputData { meals }
  assert(
    repairedInputData === null,
    "Strategy C exemption: service node inputData stays null when it references keys not in prevNode.outputData",
  );
}

// ── Regression #9: Strategy F — remove truly orphaned keys ───────────────────
//    When nextNode.inputData contains keys that have NO upstream source
//    (not in prevNode.outputData, prevNode.inputData, or group.inputData),
//    Strategy F should remove them so the pipeline can be fixed.

console.log(
  "\n📋 Regression #9: Strategy F — remove orphaned inputData keys with no upstream source",
);

function testStrategyF_RemovesOrphanedKey() {
  // Scenario: basketball "Join Games" group
  // prevNode "Fetch Available Games" outputs { games: [...] }
  // nextNode "Join Game" needs { games, selectedGame, userId }
  // - selectedGame: NOT in prevNode.outputData, prevNode.inputData, or group.inputData → ORPHANED
  // - userId: IS in group.inputData → Strategy E should propagate it, Strategy F skips it
  const groupId = "group-join-games";
  const prevNode = makeTaskNode({
    id: "task-fetch-games",
    parentNode: groupId,
    y: 100,
    functionCode:
      "return { games: [{ id: 'g1', hostId: 'u1' }, { id: 'g2', hostId: 'u2' }, { id: 'g3', hostId: 'u3' }] };",
    inputData: { userId: "user-001" },
    outputData: {
      games: [
        { id: "g1", hostId: "u1" },
        { id: "g2", hostId: "u2" },
        { id: "g3", hostId: "u3" },
      ],
    },
  });

  const nextNode = makeTaskNode({
    id: "task-join-game",
    parentNode: groupId,
    y: 200,
    functionCode:
      "return { success: true, gameId: inputData.selectedGame.id, userId: inputData.userId };",
    inputData: {
      games: [
        { id: "g1", hostId: "u1" },
        { id: "g2", hostId: "u2" },
        { id: "g3", hostId: "u3" },
      ],
      selectedGame: { id: "g1", hostId: "u1" }, // ← ORPHANED: no upstream source
      userId: "user-001", // ← in group.inputData → Strategy E will handle
    },
    outputData: { success: true, gameId: "g1", userId: "user-001" },
  });

  const groupNode = makeGroupNode({
    id: groupId,
    // userId is in group.inputData, but selectedGame is NOT
    inputData: {
      games: [
        { id: "g1", hostId: "u1" },
        { id: "g2", hostId: "u2" },
        { id: "g3", hostId: "u3" },
      ],
      userId: "user-001",
    },
    outputData: { success: true, gameId: "g1", userId: "user-001" },
  });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];
  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedNext = repaired.find((n) => n.id === "task-join-game");
  const repairedInput = repairedNext?.data?.execution?.config?.nodeData
    ?.inputData as Record<string, unknown> | null | undefined;

  // selectedGame should be removed (orphaned — no upstream source)
  assert(
    !repairedInput || !("selectedGame" in (repairedInput ?? {})),
    "Strategy F: orphaned key 'selectedGame' removed from nextNode.inputData",
  );
  // userId should NOT be removed (it IS in group.inputData)
  // After Strategy E+F+A, the node should have games + userId at minimum
  // (the while loop will keep running until stable)
}

function testStrategyF_KeepsNonOrphanedKeys() {
  // Scenario: nextNode needs { games, userId } — both are traceable
  // games: in prevNode.outputData
  // userId: in group.inputData (Strategy E)
  // Neither is orphaned → Strategy F should NOT remove anything
  const groupId = "group-keep-valid";
  const prevNode = makeTaskNode({
    id: "task-fetch-g",
    parentNode: groupId,
    y: 100,
    functionCode: "return { games: inputData.games };",
    inputData: {
      userId: "user-001",
      games: [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
    },
    outputData: { games: [{ id: "g1" }, { id: "g2" }, { id: "g3" }] },
  });

  const nextNode = makeTaskNode({
    id: "task-join-g",
    parentNode: groupId,
    y: 200,
    functionCode:
      "return { joinedGame: inputData.games[0], userId: inputData.userId };",
    inputData: {
      games: [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
      userId: "user-001", // in group.inputData → Strategy E propagates, then Strategy A passes through
    },
    outputData: { joinedGame: { id: "g1" }, userId: "user-001" },
  });

  const groupNode = makeGroupNode({
    id: groupId,
    inputData: {
      games: [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
      userId: "user-001",
    },
    outputData: { joinedGame: { id: "g1" }, userId: "user-001" },
  });

  const nodes: WorkflowNode[] = [groupNode, prevNode, nextNode];
  const repaired = deterministicRepairPipelineStrategyA(nodes);
  const repairedNext = repaired.find((n) => n.id === "task-join-g");
  const repairedInput = repairedNext?.data?.execution?.config?.nodeData
    ?.inputData as Record<string, unknown> | null | undefined;

  // userId should still be present (it's in group.inputData → valid traceable key)
  assert(
    repairedInput != null && "userId" in (repairedInput ?? {}),
    "Strategy F: non-orphaned key 'userId' (traceable via group.inputData) is preserved",
  );
  // games should still be present
  assert(
    repairedInput != null && "games" in (repairedInput ?? {}),
    "Strategy F: non-orphaned key 'games' (in prevNode.outputData) is preserved",
  );
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

  console.log("");
  testStrategyC_ServiceNodeExemption_MismatchedTemplateVars();
  testDeepNestedEmptyArrayPadding();

  console.log("");
  testStrategyF_RemovesOrphanedKey();
  testStrategyF_KeepsNonOrphanedKeys();

  console.log(
    "\n📋 Regression #10: Nested empty object in array element (courts[i].conditions={})",
  );
  testNestedEmptyObjectInArray();

  console.log(
    "\n📋 Regression #11: Trivial decision node (all-null inputData, functionCode ignores it)",
  );
  testTrivialDecisionNodeRepair();

  console.log(
    "\n📋 Regression #12: Strategy B3 fallback — outputData empty array with no inputData match",
  );
  testStrategyB3_Fallback();

  console.log(
    "\n📋 Regression #13: deterministicRepairFunctionCodeMismatch fallback for orphaned fields inside GroupNode",
  );
  testFunctionCodeMismatchOrphanedFallback();

  console.log(
    "\n📋 Regression #14: deterministicRepairParentChildDataFlow — service child aligned to task parent",
  );
  testParentChildDataFlowRepair_ServiceChild();
  testParentChildDataFlowRepair_TaskChild();

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

// ── Regression #10: Nested empty object inside array element ─────────────────
function testNestedEmptyObjectInArray(): void {
  const node = makeTaskNode({
    id: "task-court-discovery",
    inputData: {
      courts: [
        {
          id: "court-1",
          name: "Local Park",
          location: { lat: 37.5, lng: 127.0 },
          conditions: {},
        },
        {
          id: "court-2",
          name: "Community Center",
          location: { lat: 37.6, lng: 127.1 },
          conditions: {},
        },
        {
          id: "court-3",
          name: "Sports Hall",
          location: { lat: 37.7, lng: 127.2 },
          conditions: {},
        },
      ],
    },
    outputData: { filteredCourts: [{ id: "court-1", name: "Local Park" }] },
  });

  const before = validateEmptyDataShape([node]);
  assert(
    !before.valid,
    "Nested empty object: courts[i].conditions={} triggers EMPTY_DATA_SHAPE",
  );

  const repaired = deterministicRepairEmptyDataShape([node]);
  const repairedNode = repaired[0];
  const repairedInputData = (
    repairedNode.data as {
      execution?: { config?: { nodeData?: { inputData?: unknown } } };
    }
  )?.execution?.config?.nodeData?.inputData as
    | { courts: { conditions: unknown }[] }
    | undefined;

  assert(
    Array.isArray(repairedInputData?.courts) &&
      repairedInputData!.courts.every(
        (c) =>
          typeof c.conditions === "object" &&
          c.conditions !== null &&
          Object.keys(c.conditions as object).length > 0,
      ),
    "Nested empty object: courts[i].conditions filled with non-empty object after repair",
  );

  const after = validateEmptyDataShape(repaired);
  assert(
    after.valid,
    "Nested empty object: EMPTY_DATA_SHAPE resolved after repair",
  );
}

// ── Regression #11: deterministicRepairTrivialDecisionNodes ──────────────────
function testTrivialDecisionNodeRepair(): void {
  // Decision node with all-null inputData and functionCode that doesn't reference inputData
  const decisionNode: WorkflowNode = {
    id: "decision-handle-error",
    type: "decision",
    parentNode: undefined,
    position: { x: 0, y: 0 },
    data: {
      title: "Handle Fetch Error",
      execution: {
        config: {
          functionCode: "return false;",
          nodeData: {
            inputData: { reviews: null },
            outputData: false,
          },
        },
      },
    },
  } as unknown as WorkflowNode;

  const repaired = deterministicRepairTrivialDecisionNodes([decisionNode]);
  const repairedConfig = (
    repaired[0].data as {
      execution?: { config?: { nodeData?: { inputData?: unknown } } };
    }
  )?.execution?.config?.nodeData;

  assert(
    repairedConfig?.inputData === null,
    "Trivial decision node: all-null inputData set to null when functionCode doesn't reference it",
  );

  // Decision node with some non-null inputData — should NOT be changed
  const nonTrivialNode: WorkflowNode = {
    id: "decision-check-success",
    type: "decision",
    parentNode: undefined,
    position: { x: 0, y: 0 },
    data: {
      title: "Check Success",
      execution: {
        config: {
          functionCode: "return inputData.success === true;",
          nodeData: {
            inputData: { success: false },
            outputData: false,
          },
        },
      },
    },
  } as unknown as WorkflowNode;

  const nonTrivialRepaired = deterministicRepairTrivialDecisionNodes([
    nonTrivialNode,
  ]);
  const nonTrivialConfig = (
    nonTrivialRepaired[0].data as {
      execution?: { config?: { nodeData?: { inputData?: unknown } } };
    }
  )?.execution?.config?.nodeData;

  assert(
    nonTrivialConfig?.inputData !== null,
    "Non-trivial decision node (non-null values): inputData NOT changed",
  );
}

// ── Regression #12: Strategy B3 fallback for top-level outputData empty array ─
function testStrategyB3_Fallback(): void {
  // "Create Game" node has outputData.attendees = [] with no matching inputData key
  // and functionCode does not use a passthrough pattern for attendees.
  // Strategy B1 (same-key) and B2 (functionCode pattern) both fail.
  // Strategy B3 should generate a placeholder.
  const node = makeTaskNode({
    id: "task-create-game",
    functionCode:
      "const gameId = 'game-' + Date.now(); return { gameId, success: true, attendees: [] };",
    inputData: {
      gameData: {
        title: "Basketball Game",
        location: "Court A",
        maxPlayers: 10,
      },
    },
    outputData: { gameId: "game-001", success: true, attendees: [] },
  });

  const before = validateEmptyDataShape([node]);
  assert(
    !before.valid,
    "B3 fallback: validator catches attendees: [] before repair",
  );

  const repaired = deterministicRepairEmptyDataShape([node]);
  const config = getExecutionConfig(repaired[0]);
  const attendees = (config?.nodeData?.outputData as Record<string, unknown>)
    ?.attendees;

  assert(
    Array.isArray(attendees) && (attendees as unknown[]).length >= 3,
    "B3 fallback: attendees should be padded to 3+ placeholder items",
  );

  const afterRepair = validateEmptyDataShape(repaired);
  assert(
    afterRepair.valid,
    "B3 fallback: EMPTY_DATA_SHAPE resolved after Strategy B3 repair",
  );
}

// ── Regression #13: deterministicRepairFunctionCodeMismatch fallback ──────────
// When a task inside a GroupNode references fields that don't exist anywhere
// (orphaned fields), the fallback should generate a spread passthrough.
function testFunctionCodeMismatchOrphanedFallback(): void {
  // GroupNode with inputData={success: true}
  const groupNode = makeGroupNode({
    id: "group-game-creation",
    inputData: { success: true },
    outputData: { success: true },
  });

  // Task "Validate Game Creation" inside GroupNode
  // functionCode references {time, location, participantLimit} via dot notation — NOT in inputData
  // inputData = {success: true} (set by boundary sync from GroupNode)
  const validateTaskNode = makeTaskNode({
    id: "task-validate-game-creation",
    parentNode: "group-game-creation",
    functionCode:
      "if (!inputData.time || !inputData.location || !inputData.participantLimit) return { isValid: false }; return { isValid: true };",
    inputData: { success: true }, // only 'success' available
    outputData: { isValid: true },
  });

  const nodes: WorkflowNode[] = [groupNode, validateTaskNode];
  const repaired = deterministicRepairFunctionCodeMismatch(nodes);

  const repairedTask = repaired.find(
    (n) => n.id === "task-validate-game-creation",
  );
  const repairedConfig = getExecutionConfig(repairedTask!);

  assert(
    repairedConfig?.functionCode?.includes("...inputData") ||
      repairedConfig?.functionCode?.includes("processed") ||
      !repairedConfig?.functionCode?.includes("participantLimit"),
    "Orphaned fallback: functionCode no longer references orphaned 'participantLimit'",
  );
  assert(
    !!repairedConfig?.functionCode?.includes("...inputData"),
    "Orphaned fallback: functionCode uses spread passthrough instead of orphaned refs",
  );
  assert(
    (repairedConfig?.nodeData?.outputData as Record<string, unknown>)
      ?.processed === true,
    "Orphaned fallback: outputData includes processed:true to match new functionCode",
  );
}

// ── Regression #14: deterministicRepairParentChildDataFlow ───────────────────
// When a task parent outputs {macros:[...]} but a child service inputs {userId:"..."},
// the repair should align the service's inputData to the parent's outputData.
function testParentChildDataFlowRepair_ServiceChild(): void {
  // Parent task outputs macros
  const macroTask = makeTaskNode({
    id: "task-macro-tracking",
    functionCode: "return { macros: inputData.macros };",
    inputData: {
      macros: [
        { name: "protein", amount: 50, unit: "g" },
        { name: "carbs", amount: 200, unit: "g" },
        { name: "fat", amount: 70, unit: "g" },
      ],
    },
    outputData: {
      macros: [
        { name: "protein", amount: 50, unit: "g" },
        { name: "carbs", amount: 200, unit: "g" },
        { name: "fat", amount: 70, unit: "g" },
      ],
    },
  });

  // Child service inputs userId (mismatch with parent output)
  const insightsService = makeServiceNode({
    id: "service-fetch-insights",
    parentNode: "task-macro-tracking",
    inputData: { userId: "user-123" },
    outputData: {
      insights: [
        { date: "2025-01-01", calories: 2000, recommendation: "Good job" },
      ],
    },
    http: {
      method: "POST",
      endpoint: "/api/insights",
      headers: {},
      body: { userId: "{{inputData.userId}}" }, // template var referencing old key
    },
  });

  const nodes: WorkflowNode[] = [macroTask, insightsService];

  // Before repair: no overlap between parent output and child input
  const serviceConfig = getExecutionConfig(insightsService);
  const parentConfig = getExecutionConfig(macroTask);
  const parentKeys = new Set(
    Object.keys((parentConfig?.nodeData?.outputData as object) ?? {}),
  );
  const childKeys = Object.keys(
    (serviceConfig?.nodeData?.inputData as object) ?? {},
  );
  assert(
    !childKeys.every((k) => parentKeys.has(k)),
    "BEFORE: service.inputData keys [userId] not in parent.outputData keys [macros]",
  );

  const repaired = deterministicRepairParentChildDataFlow(nodes);

  const repairedService = repaired.find(
    (n) => n.id === "service-fetch-insights",
  );
  const repairedConfig = getExecutionConfig(repairedService!);
  const repairedInputKeys = Object.keys(
    (repairedConfig?.nodeData?.inputData as object) ?? {},
  );

  assert(
    repairedInputKeys.includes("macros"),
    "AFTER: service.inputData now contains 'macros' (aligned to parent output)",
  );
  assert(
    !repairedInputKeys.includes("userId"),
    "AFTER: service.inputData no longer contains old 'userId' key",
  );

  // Check http.body template var for userId was stripped
  const repairedHttp = (
    repairedService?.data as { http?: Record<string, unknown> }
  )?.http;
  const repairedBody = (repairedHttp?.body ?? {}) as Record<string, unknown>;
  assert(
    !JSON.stringify(repairedBody).includes("inputData.userId"),
    "AFTER: http.body no longer contains {{inputData.userId}} template var",
  );
}

function testParentChildDataFlowRepair_TaskChild(): void {
  // Parent task outputs { result }
  const parentTask = makeTaskNode({
    id: "task-parent",
    functionCode: "return { result: inputData.value * 2 };",
    inputData: { value: 42 },
    outputData: { result: 84 },
  });

  // Child task inputs { score } (mismatch)
  const childTask = makeTaskNode({
    id: "task-child",
    parentNode: "task-parent",
    functionCode: "return { grade: inputData.score > 80 ? 'A' : 'B' };",
    inputData: { score: 90 },
    outputData: { grade: "A" },
  });

  const nodes: WorkflowNode[] = [parentTask, childTask];
  const repaired = deterministicRepairParentChildDataFlow(nodes);

  const repairedChild = repaired.find((n) => n.id === "task-child");
  const repairedConfig = getExecutionConfig(repairedChild!);
  const repairedInputKeys = Object.keys(
    (repairedConfig?.nodeData?.inputData as object) ?? {},
  );

  assert(
    repairedInputKeys.includes("result"),
    "AFTER: task child.inputData now contains 'result' (from parent output)",
  );
  assert(
    !repairedInputKeys.includes("score"),
    "AFTER: task child.inputData no longer contains old 'score' key",
  );
  assert(
    !!repairedConfig?.functionCode?.includes("...inputData"),
    "AFTER: task child.functionCode uses spread passthrough",
  );
}
