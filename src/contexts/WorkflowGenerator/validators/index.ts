import type {
  ValidationContext,
  ValidationProgress,
  ValidationResult,
} from "../../../types/ai/validators";
import type { WorkflowNode } from "@/types";
import { validateParentNodeStructure } from "./parentNodeStructure";
import {
  validateCircularReferences,
  validateParentNodeCycles,
} from "./circularReference";
import { validateDecisionNodes, repairDecisionNodes } from "./decisionNode";
import { validateGroupNodePipelines, deterministicRepairGroupBoundaries, deterministicRepairPipelineStrategyA } from "./groupNodePipeline";
import { validateGroupNodeMinChildren } from "./groupNodeMinChildren";
import { validateRootGroupNodes } from "./rootGroupNode";
import { validateFunctionCodeInputData } from "./functionCodeMismatch";
import { validateStartNodeChildren } from "./startNodeChild";
import { validateSyncOnlyNodes } from "./syncOnlyNodes";
import { validateOutputDataTypeMismatch, deterministicRepairOutputDataTypeMismatch } from "./outputDataTypeMismatch";
import { validateServiceNodeFunctionCode } from "./serviceNodeFunctionCode";
import { validateServiceNodeSimulation } from "./serviceNodeSimulation";
import { validateServiceNodeRuntime } from "./serviceNodeRuntime";
import { validateParentChildDataFlow } from "./parentChildDataFlow";
import { validateFunctionCodeRequired } from "./functionCodeRequired";
import { validateEmptyDataShape } from "./emptyDataShape";
import { validateTrivialNodes } from "./trivialNode";
import { validateDecisionNodeOutputFormat } from "./decisionNodeOutputFormat";
import { buildBatchRepairPrompt } from "@/fixtures/prompts/modification";
import {
  applyAIFixes,
  checkAIResponseSanity,
  applyDeterministicCodeGeneration,
  deterministicRepairEmptyDataShape,
  getExecutionConfig,
} from "../utils/validationUtils";

export { applyAIFixes };

interface Validator {
  name: string;
  validate: (
    nodes: WorkflowNode[],
  ) => ValidationResult | Promise<ValidationResult>;
}

/**
 * Run validation pipeline.
 *
 * 1. Deterministic pre-pass: strip parentNode: "undefined" strings.
 * 2. Mandatory Critical Gate (while loop): all validators except decisionNode.
 *    Runs until zero violations remain — no retry cap.
 * 3. Dialog Phase: validateDecisionNodes → repairDecisionNodes (dialog.confirm).
 *
 * @param context - Validation context with nodes, dialog, and updateWorkflowAction
 * @param onProgress - Optional callback to report validation progress
 * @returns Updated nodes after all validations and repairs
 */
export async function runValidationPipeline(
  context: ValidationContext,
  onProgress?: (progress: ValidationProgress) => void,
): Promise<WorkflowNode[]> {
  let workingNodes = [...context.nodes];

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Deterministic pre-passes (semantically safe transforms only)
  //   a. Code generation: service/decision functionCode (always correct by design)
  //   b. Array padding: 1-2 element arrays → 3 (preserves type intent)
  //      Empty arrays (length=0) are left for AI (type is unknown)
  //   c. GroupNode boundary sync:
  //      - output_boundary: GroupNode.outputData = lastChild.outputData (schema sync, safe)
  //      - input_boundary:  firstChild.inputData = GroupNode.inputData (schema sync, safe)
  //      Both are pure schema alignment ops that preserve AI intent.
  // ─────────────────────────────────────────────────────────────────────────
  workingNodes = applyDeterministicCodeGeneration(workingNodes);
  workingNodes = deterministicRepairEmptyDataShape(workingNodes);
  workingNodes = await deterministicRepairOutputDataTypeMismatch(workingNodes);
  workingNodes = deterministicRepairGroupBoundaries(workingNodes);
  workingNodes = deterministicRepairPipelineStrategyA(workingNodes);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Mandatory Critical Gate — all validators except decisionNode
  // Loops until ALL violations are resolved (no retry cap).
  // ─────────────────────────────────────────────────────────────────────────
  const mandatoryValidators: Validator[] = [
    // Structural
    { name: "Parent Node Structure", validate: validateParentNodeStructure },
    { name: "Circular References", validate: validateCircularReferences },
    { name: "Circular ParentNode Cycles", validate: validateParentNodeCycles },
    // Semantic & code
    { name: "Start Node Children", validate: validateStartNodeChildren },
    { name: "Sync-Only Nodes", validate: validateSyncOnlyNodes },
    { name: "GroupNode Pipelines", validate: validateGroupNodePipelines },
    { name: "GroupNode Min Children", validate: validateGroupNodeMinChildren },
    { name: "Root GroupNodes", validate: validateRootGroupNodes },
    { name: "functionCode Mismatch", validate: validateFunctionCodeInputData },
    {
      name: "outputData Type Mismatch",
      validate: validateOutputDataTypeMismatch,
    },
    {
      name: "Service Node functionCode",
      validate: validateServiceNodeFunctionCode,
    },
    {
      name: "Service Node Simulation",
      validate: validateServiceNodeSimulation,
    },
    { name: "Service Node Runtime", validate: validateServiceNodeRuntime },
    { name: "Parent-Child Data Flow", validate: validateParentChildDataFlow },
    { name: "Trivial Task Nodes", validate: validateTrivialNodes },
    { name: "FunctionCode Required", validate: validateFunctionCodeRequired },
    { name: "Empty Data Shape", validate: validateEmptyDataShape },
    {
      name: "Decision Node Output Format",
      validate: validateDecisionNodeOutputFormat,
    },
  ];

  // Compute initial violations
  let mandatoryViolations: {
    validatorName: string;
    result: ValidationResult;
  }[] = [];

  for (const validator of mandatoryValidators) {
    const result = await validator.validate(workingNodes);
    if (!result.valid) {
      mandatoryViolations.push({ validatorName: validator.name, result });
    }
  }

  // ── DIAGNOSTIC: single copyable log block ──
  {
    const nodeTree = workingNodes
      .map((n) =>
        `  ${String(n.type ?? "?").padEnd(9)}| parentNode=${String(n.parentNode ?? "null").padEnd(42)}| "${n.data?.title ?? ""}"`,
      )
      .join("\n");

    const violationLines = mandatoryViolations.length === 0
      ? "  ✅ No violations — generation was clean!"
      : mandatoryViolations.map(({ validatorName, result }) => {
          const nodes = result.affectedNodes?.map((n) => ({
            id: n.id,
            type: n.type,
            parentNode: n.parentNode ?? null,
            title: n.data?.title,
            inputData: getExecutionConfig(n)?.nodeData?.inputData,
            outputData: getExecutionConfig(n)?.nodeData?.outputData,
            functionCode: getExecutionConfig(n)?.functionCode,
          }));
          return (
            `  ❌ ${validatorName}\n` +
            `     errorMessage: ${result.errorMessage}\n` +
            `     affectedNodes: ${JSON.stringify(nodes, null, 2).split("\n").join("\n     ")}`
          );
        }).join("\n\n");

    console.log(
      `\n${"=".repeat(70)}\n[DIAG] GENERATION REPORT\n${"=".repeat(70)}\n` +
      `[TREE]\n${nodeTree}\n\n` +
      `[VIOLATIONS]\n${violationLines}\n` +
      `${"=".repeat(70)}\n`,
    );
  }

  // [Deterministic pre-pass] Removed: do not alter AI-generated nodes before first AI call
  // workingNodes = deterministicRepairGroupBoundaries(workingNodes);
  // workingNodes = deterministicRepairServiceNodes(workingNodes);
  // workingNodes = rebuildGroupChildren(workingNodes);
  // mandatoryViolations = [];
  // for (const validator of mandatoryValidators) {
  //   const result = await validator.validate(workingNodes);
  //   if (!result.valid) {
  //     mandatoryViolations.push({ validatorName: validator.name, result });
  //   }
  // }

  const MAX_RETRIES = 5;
  let retryCount = 0;

  while (mandatoryViolations.length > 0) {
    onProgress?.({ completedValidators: 0, status: "repairing" });

    const directAffectedIds = mandatoryViolations.flatMap(
      (v) => v.result.affectedNodes?.map((n) => n.id) ?? [],
    );

    // Also include the direct parents of affected nodes so the AI can reparent
    // nodes to their grandparent level (e.g., move a nested GroupNode up to sibling)
    const nodeMap = new Map(workingNodes.map((n) => [n.id, n]));
    const parentIds = directAffectedIds
      .map((id) => nodeMap.get(id)?.parentNode)
      .filter((pid): pid is string => typeof pid === "string" && pid.length > 0);

    const allAffectedIds = Array.from(
      new Set([...directAffectedIds, ...parentIds]),
    );

    const batchPrompt = buildBatchRepairPrompt(
      mandatoryViolations,
      workingNodes,
    );

    // ── DIAGNOSTIC: log retry summary ──
    console.log(
      `[DIAG] Retry #${retryCount + 1} violations: [${mandatoryViolations.map((v) => v.validatorName).join(", ")}]`,
    );

    const aiResponse = await context.updateWorkflowAction({
      targetNodeIds:
        allAffectedIds.length > 0
          ? allAffectedIds
          : [workingNodes[0]?.id ?? ""],
      prompt: batchPrompt,
      nodes: workingNodes,
    });

    // ── DIAGNOSTIC: log AI response summary ──
    console.log(
      `[DIAG] Retry #${retryCount + 1} AI response: update=${aiResponse?.nodes?.update?.length ?? 0} create=${aiResponse?.nodes?.create?.length ?? 0} delete=${aiResponse?.nodes?.delete?.length ?? 0}`,
    );

    // Sanity-check AI response before applying — catches silent no-op cases
    const sanity = checkAIResponseSanity(
      aiResponse,
      workingNodes,
      allAffectedIds,
    );
    if (!sanity.valid) {
      console.warn(
        `[Mandatory] AI response failed sanity check: ${sanity.reason}. Retrying...`,
      );
      retryCount++;
      if (retryCount >= MAX_RETRIES) break;
      continue;
    }

    workingNodes = applyAIFixes(workingNodes, aiResponse);
    // Re-apply deterministic passes after AI fix
    workingNodes = applyDeterministicCodeGeneration(workingNodes);
    workingNodes = deterministicRepairEmptyDataShape(workingNodes);
    workingNodes = await deterministicRepairOutputDataTypeMismatch(workingNodes);
    workingNodes = deterministicRepairGroupBoundaries(workingNodes);
    workingNodes = deterministicRepairPipelineStrategyA(workingNodes);

    // Re-validate all mandatory validators
    mandatoryViolations = [];
    for (const validator of mandatoryValidators) {
      const result = await validator.validate(workingNodes);
      if (!result.valid) {
        // console.log(`[Mandatory] Still failing: ${validator.name}`, result);
        mandatoryViolations.push({ validatorName: validator.name, result });
      }
    }

    retryCount++;
    if (retryCount >= MAX_RETRIES && mandatoryViolations.length > 0) {
      // ── DIAGNOSTIC: single copyable MAX_RETRIES log ──
      {
        const finalLines = mandatoryViolations.map(({ validatorName, result }) => {
          const nodes = result.affectedNodes?.map((n) => ({
            id: n.id,
            type: n.type,
            parentNode: n.parentNode ?? null,
            title: n.data?.title,
            inputData: getExecutionConfig(n)?.nodeData?.inputData,
            outputData: getExecutionConfig(n)?.nodeData?.outputData,
            functionCode: getExecutionConfig(n)?.functionCode,
          }));
          return (
            `  ❌ ${validatorName}\n` +
            `     errorMessage: ${result.errorMessage}\n` +
            `     affectedNodes: ${JSON.stringify(nodes, null, 2).split("\n").join("\n     ")}`
          );
        }).join("\n\n");

        console.log(
          `\n${"=".repeat(70)}\n[DIAG] MAX_RETRIES REACHED\n${"=".repeat(70)}\n` +
          finalLines + "\n" +
          `${"=".repeat(70)}\n`,
        );
      }
      throw new Error(
        `[Mandatory] Max retries (${MAX_RETRIES}) reached. Breaking with ${mandatoryViolations.length} violation(s) remaining: ${mandatoryViolations.map((v) => v.validatorName)}`,
      );
    }
  }

  // Safety gate: removed — deterministic repairs are no longer applied after retries
  // if (mandatoryViolations.length > 0) {
  //   workingNodes = deterministicRepairParentNodeCycles(workingNodes);
  //   workingNodes = deterministicRepairDecisionNodeOutputFormat(workingNodes);
  //   workingNodes = deterministicRepairGroupBoundaries(workingNodes);
  //   workingNodes = rebuildGroupChildren(workingNodes);
  // }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Dialog Phase — decisionNode (user confirms or cancels)
  // ─────────────────────────────────────────────────────────────────────────
  const decisionResult = await validateDecisionNodes(workingNodes);
  if (!decisionResult.valid) {
    workingNodes = await repairDecisionNodes({
      ...context,
      nodes: workingNodes,
    });
  }

  onProgress?.({
    completedValidators: mandatoryValidators.length + 1,
    status: "completed",
  });

  // Final: re-apply deterministic passes (code generation + array padding)
  workingNodes = applyDeterministicCodeGeneration(workingNodes);
  workingNodes = deterministicRepairEmptyDataShape(workingNodes);

  // rebuildGroupChildren removed — do not alter AI-generated node structure
  // workingNodes = rebuildGroupChildren(workingNodes);
  return workingNodes;
}
