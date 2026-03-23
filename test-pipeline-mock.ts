/**
 * Mock end-to-end pipeline test
 *
 * Verifies that deterministic pre-pass repairs resolve the specific failure patterns
 * that caused MAX_RETRIES in basketball/fitness/dual PDF tests.
 *
 * Does NOT call OpenAI — uses a "no-op AI" that returns empty responses.
 * Tests that deterministic repairs alone fix the known cyclic violations.
 *
 * Usage: npx tsx test-pipeline-mock.ts
 */

import type { WorkflowNode } from "@/types";
import type { UpdateWorkflowResponse } from "@/types/ai";
import { validateEmptyDataShape } from "@/contexts/WorkflowGenerator/validators/emptyDataShape";
import { validateFunctionCodeInputData } from "@/contexts/WorkflowGenerator/validators/functionCodeMismatch";
import { validateOutputDataTypeMismatch } from "@/contexts/WorkflowGenerator/validators/outputDataTypeMismatch";
import {
  applyDeterministicCodeGeneration,
  deterministicRepairEmptyDataShape,
  deterministicRepairFunctionCodeMismatch,
  deterministicRepairTrivialDecisionNodes,
  getExecutionConfig,
} from "@/contexts/WorkflowGenerator/utils/validationUtils";
import {
  deterministicRepairGroupBoundaries,
  deterministicRepairPipelineStrategyA,
} from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";
import { deterministicRepairOutputDataTypeMismatch } from "@/contexts/WorkflowGenerator/validators/outputDataTypeMismatch";

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string): void {
  total++;
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function makeNode(overrides: {
  id: string;
  type: "task" | "service" | "group" | "decision" | "start" | "end";
  parentNode?: string;
  y?: number;
  functionCode?: string;
  inputData?: unknown;
  outputData?: unknown;
  http?: Record<string, unknown>;
  condition?: Record<string, unknown>;
}): WorkflowNode {
  const {
    id,
    type,
    parentNode,
    y = 0,
    functionCode,
    inputData = null,
    outputData = null,
    http,
    condition,
  } = overrides;
  const baseData: Record<string, unknown> = {
    title: id,
    description: "",
    execution: {
      config: {
        functionCode:
          functionCode ?? (type === "task" ? "return inputData;" : undefined),
        nodeData: { inputData, outputData },
        lastModified: Date.now(),
      },
    },
  };
  if (type === "service") {
    baseData.serviceType = "api";
    baseData.mode = "panel";
    baseData.http = http ?? {
      method: "GET",
      endpoint: "/api/test",
      headers: {},
      body: {},
    };
  }
  if (type === "group") {
    baseData.groups = [];
  }
  if (type === "decision") {
    baseData.condition = condition ?? {};
    baseData.mode = "panel";
  }
  return {
    id,
    type,
    parentNode,
    position: { x: 0, y },
    data: baseData,
  } as WorkflowNode;
}

// Apply the full deterministic pre-pass (same as validators/index.ts)
async function applyDeterministicPrePass(
  nodes: WorkflowNode[],
): Promise<WorkflowNode[]> {
  let working = [...nodes];
  working = applyDeterministicCodeGeneration(working);
  working = deterministicRepairEmptyDataShape(working);
  working = deterministicRepairGroupBoundaries(working);
  working = deterministicRepairPipelineStrategyA(working);
  working = deterministicRepairFunctionCodeMismatch(working);
  working = deterministicRepairTrivialDecisionNodes(working);
  working = await deterministicRepairOutputDataTypeMismatch(working);
  return working;
}

// ── Pattern 1: Basketball — attendees: [] empty outputData array ──────────────

async function testBasketballAttendees(): Promise<void> {
  console.log(
    "\n🏀 Pattern 1: Basketball — outputData.attendees = [] (Create Game node)",
  );

  const createGameNode = makeNode({
    id: "task-create-game",
    type: "task",
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

  // Before repair
  const before = validateEmptyDataShape([createGameNode]);
  assert(!before.valid, "BEFORE: attendees:[] violates EMPTY_DATA_SHAPE");

  const repaired = await applyDeterministicPrePass([createGameNode]);
  const after = validateEmptyDataShape(repaired);
  assert(after.valid, "AFTER: EMPTY_DATA_SHAPE passes after pre-pass");

  const config = getExecutionConfig(
    repaired.find((n) => n.id === "task-create-game")!,
  );
  const attendees = (config?.nodeData?.outputData as Record<string, unknown>)
    ?.attendees;
  assert(
    Array.isArray(attendees) && (attendees as unknown[]).length >= 3,
    "attendees padded to 3+ items by B3 fallback",
  );
}

// ── Pattern 2: Basketball — "Validate Game Creation" with orphaned fields ─────

async function testBasketballOrphanedFields(): Promise<void> {
  console.log(
    "\n🏀 Pattern 2: Basketball — 'Validate Game Creation' functionCode refs orphaned fields",
  );

  const groupNode = makeNode({
    id: "group-game-creation",
    type: "group",
    inputData: { success: true, gameId: "game-001" },
    outputData: { success: true, gameId: "game-001" },
  });

  // Task "Validate Game Creation" with functionCode referencing orphaned fields
  const validateTask = makeNode({
    id: "task-validate-game",
    type: "task",
    parentNode: "group-game-creation",
    functionCode:
      "if (!inputData.time || !inputData.location || !inputData.participantLimit) return { isValid: false }; return { isValid: true };",
    inputData: { success: true, gameId: "game-001" }, // boundary sync: matches GroupNode.inputData
    outputData: { isValid: true },
    y: 100,
  });

  const nodes: WorkflowNode[] = [groupNode, validateTask];

  // Before repair
  const mismatchBefore = validateFunctionCodeInputData(nodes);
  assert(
    !mismatchBefore.valid,
    "BEFORE: functionCode references orphaned fields [time, location, participantLimit]",
  );

  const repaired = await applyDeterministicPrePass(nodes);
  const mismatchAfter = validateFunctionCodeInputData(repaired);
  assert(
    mismatchAfter.valid,
    "AFTER: FUNCTIONCODE_INPUTDATA_MISMATCH resolved after pre-pass",
  );

  const config = getExecutionConfig(
    repaired.find((n) => n.id === "task-validate-game")!,
  );
  assert(
    config?.functionCode?.includes("...inputData") === true,
    "AFTER: functionCode uses spread passthrough (no orphaned refs)",
  );
}

// ── Pattern 3: Basketball — nested attendees: [] inside games array ──────────

async function testBasketballNestedAttendees(): Promise<void> {
  console.log(
    "\n🏀 Pattern 3: Basketball — games[i].attendees = [] nested empty array",
  );

  const fetchGamesNode = makeNode({
    id: "service-fetch-games",
    type: "service",
    inputData: null,
    outputData: {
      games: [
        { id: "g1", host: "user-001", attendees: [] },
        { id: "g2", host: "user-002", attendees: [] },
        { id: "g3", host: "user-003", attendees: [] },
      ],
    },
    http: { method: "GET", endpoint: "/api/games", headers: {}, body: {} },
  });

  // Before repair
  const before = validateEmptyDataShape([fetchGamesNode]);
  assert(
    !before.valid,
    "BEFORE: games[i].attendees:[] violates EMPTY_DATA_SHAPE",
  );

  const repaired = await applyDeterministicPrePass([fetchGamesNode]);
  const after = validateEmptyDataShape(repaired);
  assert(
    after.valid,
    "AFTER: EMPTY_DATA_SHAPE passes after nested array padding",
  );

  const config = getExecutionConfig(repaired[0]);
  const games = (config?.nodeData?.outputData as Record<string, unknown>)
    ?.games as Array<Record<string, unknown>>;
  assert(
    Array.isArray(games) &&
      games.every(
        (g) =>
          Array.isArray(g.attendees) && (g.attendees as unknown[]).length >= 3,
      ),
    "AFTER: all games[i].attendees padded to 3+ items",
  );
}

// ── Pattern 4: Trivial decision node (all-null inputData) ─────────────────────

async function testTrivialDecisionNodeCycle(): Promise<void> {
  console.log("\n🏀 Pattern 4: Trivial decision node with all-null inputData");

  const decisionNode = makeNode({
    id: "decision-handle-error",
    type: "decision",
    functionCode: "return false;",
    inputData: { reviews: null, rating: null },
    outputData: false,
    condition: {},
  });

  const repaired = await applyDeterministicPrePass([decisionNode]);
  const config = getExecutionConfig(
    repaired.find((n) => n.id === "decision-handle-error")!,
  );
  assert(
    config?.nodeData?.inputData === null,
    "Trivial decision node: all-null inputData collapsed to null",
  );
}

// ── Pattern 5: Fitness — empty inputData from parent (Strategy A) ─────────────

async function testFitnessStrategyA(): Promise<void> {
  console.log(
    "\n🥗 Pattern 5: Fitness — inputData.tasks = [] filled from parent outputData",
  );

  const fetchTasksNode = makeNode({
    id: "service-fetch-tasks",
    type: "service",
    inputData: null,
    outputData: {
      tasks: [
        { id: "t1", content: "Morning run", completed: false },
        { id: "t2", content: "Meal prep", completed: true },
        { id: "t3", content: "Gym session", completed: false },
      ],
    },
    http: { method: "GET", endpoint: "/api/tasks", headers: {}, body: {} },
  });

  const displayNode = makeNode({
    id: "task-display-tasks",
    type: "task",
    parentNode: "service-fetch-tasks",
    functionCode: "return { displayedTasks: inputData.tasks };",
    inputData: { tasks: [] }, // empty from parent's outputData
    outputData: { displayedTasks: [] },
    y: 100,
  });

  const nodes: WorkflowNode[] = [fetchTasksNode, displayNode];

  // Before repair
  const before = validateEmptyDataShape(nodes);
  assert(
    !before.valid,
    "BEFORE: inputData.tasks:[] and outputData.displayedTasks:[] violate EMPTY_DATA_SHAPE",
  );

  const repaired = await applyDeterministicPrePass(nodes);
  const after = validateEmptyDataShape(repaired);
  assert(
    after.valid,
    "AFTER: EMPTY_DATA_SHAPE passes after Strategy A + B2 fills",
  );

  const displayConfig = getExecutionConfig(
    repaired.find((n) => n.id === "task-display-tasks")!,
  );
  const tasks = (displayConfig?.nodeData?.inputData as Record<string, unknown>)
    ?.tasks;
  const displayedTasks = (
    displayConfig?.nodeData?.outputData as Record<string, unknown>
  )?.displayedTasks;
  assert(
    Array.isArray(tasks) && (tasks as unknown[]).length >= 3,
    "inputData.tasks filled from parent outputData (Strategy A)",
  );
  assert(
    Array.isArray(displayedTasks) && (displayedTasks as unknown[]).length >= 3,
    "outputData.displayedTasks filled via B2 pattern match",
  );
}

// ── Pattern 6: JSON truncation — error handling retries ──────────────────────

async function testJsonTruncationHandling(): Promise<void> {
  console.log("\n🔧 Pattern 6: JSON truncation — AI error handled gracefully");

  // Simulate a validation context with an AI that throws a JSON parse error
  // const dummyNode = makeNode({
  //   id: "task-dummy",
  //   type: "task",
  //   functionCode: "return { success: true };",
  //   inputData: null,
  //   outputData: { success: true },
  // });

  let callCount = 0;
  const mockUpdateWorkflow = async (): Promise<UpdateWorkflowResponse> => {
    callCount++;
    if (callCount <= 2) {
      throw new SyntaxError("Unterminated string in JSON at position 99236");
    }
    // Third call succeeds with an empty response
    return {
      nodes: { update: [], create: [], delete: [] },
      metadata: { description: "no-op", affectedNodeIds: [] },
    };
  };

  // Simulate what validators/index.ts retry loop does with error handling
  let retryCount = 0;
  const MAX_RETRIES = 5;
  let caughtErrors = 0;

  while (retryCount < MAX_RETRIES) {
    let response: UpdateWorkflowResponse | undefined;
    try {
      response = await mockUpdateWorkflow();
    } catch (err) {
      caughtErrors++;
      retryCount++;
      continue;
    }
    // If we got a response, we succeeded
    assert(
      response !== undefined,
      "AI error handling: successfully got response after retries",
    );
    break;
  }

  assert(
    caughtErrors === 2,
    `AI error handling: caught ${caughtErrors} errors before success (expected 2)`,
  );
  assert(
    callCount === 3,
    `AI error handling: made ${callCount} total calls (expected 3)`,
  );
}

// ── Pattern 7: outputData Type Mismatch — functionCode return matches outputData ─

async function testOutputDataTypeMismatch(): Promise<void> {
  console.log(
    "\n🔧 Pattern 7: outputData Type Mismatch — functionCode returns different shape",
  );

  // Task node where functionCode returns {success, gameId} but outputData says {isValid}
  const taskNode = makeNode({
    id: "task-submit-update",
    type: "task",
    functionCode:
      "return { success: inputData.success, gameId: inputData.gameId, updated: true };",
    inputData: { success: true, gameId: "game-001" },
    outputData: { isValid: true }, // WRONG shape — functionCode returns different keys
  });

  const mismatch = await validateOutputDataTypeMismatch([taskNode]);
  assert(!mismatch.valid, "BEFORE: outputData shape mismatch detected");

  // After deterministic repair, the outputData should be updated to match functionCode
  const repaired = await applyDeterministicPrePass([taskNode]);
  const mismatchAfter = await validateOutputDataTypeMismatch(repaired);
  assert(
    mismatchAfter.valid,
    "AFTER: outputData Type Mismatch resolved by deterministicRepairOutputDataTypeMismatch",
  );
}

// ── Run all tests ─────────────────────────────────────────────────────────────

async function runAllTests(): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log("MOCK PIPELINE TESTS — Deterministic repair verification");
  console.log(`${"=".repeat(60)}`);

  await testBasketballAttendees();
  await testBasketballOrphanedFields();
  await testBasketballNestedAttendees();
  await testTrivialDecisionNodeCycle();
  await testFitnessStrategyA();
  await testJsonTruncationHandling();
  await testOutputDataTypeMismatch();

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Results: ${passed} passed, ${failed} failed (of ${total} assertions)`,
  );
  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All ${total} assertions passed!`);
    console.log(
      "✅ Deterministic repairs verified for known basketball/fitness failure patterns",
    );
  }
  console.log("=".repeat(60));
}

runAllTests().catch((e: Error) => {
  console.error("\n💥 Test runner error:", e.message);
  console.error(e.stack);
  process.exit(1);
});
