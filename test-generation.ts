/**
 * End-to-end generation + validation test
 * Usage: npx tsx --tsconfig tsconfig.json test-generation.ts
 */

import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Env ───────────────────────────────────────────────────────────────────────
const envText = readFileSync(resolve(__dirname, ".env.local"), "utf-8");
const envMap = Object.fromEntries(
  envText.split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")];
    }),
);
const API_KEY = envMap.OPENAI_API_KEY;
if (!API_KEY) throw new Error("OPENAI_API_KEY not found in .env.local");
process.env.OPENAI_API_KEY = API_KEY;

// ── Imports (path aliases work via tsconfig + tsx) ────────────────────────────
import { GENERATION_SYSTEM_PROMPT, getGenerationContent } from "@/fixtures/prompts/generation";
import {
  MODIFICATION_SYSTEM_PROMPT,
  getModificationContent,
  buildBatchRepairPrompt,
  buildEditResultSchema,
} from "@/fixtures/prompts/modification";
import { ANALYSIS_SYSTEM_PROMPT, getAnalysisContent } from "@/fixtures/prompts/analysis";
import { buildGenerationContexts } from "@/ai/utils";
import { validateParentNodeStructure } from "@/contexts/WorkflowGenerator/validators/parentNodeStructure";
import { validateCircularReferences, validateParentNodeCycles } from "@/contexts/WorkflowGenerator/validators/circularReference";

import { validateGroupNodePipelines } from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";
import { validateGroupNodeMinChildren } from "@/contexts/WorkflowGenerator/validators/groupNodeMinChildren";
import { validateRootGroupNodes } from "@/contexts/WorkflowGenerator/validators/rootGroupNode";
import { validateFunctionCodeInputData } from "@/contexts/WorkflowGenerator/validators/functionCodeMismatch";
import { validateStartNodeChildren } from "@/contexts/WorkflowGenerator/validators/startNodeChild";
import { validateSyncOnlyNodes } from "@/contexts/WorkflowGenerator/validators/syncOnlyNodes";
import { validateOutputDataTypeMismatch } from "@/contexts/WorkflowGenerator/validators/outputDataTypeMismatch";
import { validateServiceNodeFunctionCode } from "@/contexts/WorkflowGenerator/validators/serviceNodeFunctionCode";
import { validateServiceNodeSimulation } from "@/contexts/WorkflowGenerator/validators/serviceNodeSimulation";
import { validateServiceNodeRuntime } from "@/contexts/WorkflowGenerator/validators/serviceNodeRuntime";
import { validateParentChildDataFlow } from "@/contexts/WorkflowGenerator/validators/parentChildDataFlow";
import { validateFunctionCodeRequired } from "@/contexts/WorkflowGenerator/validators/functionCodeRequired";
import { validateEmptyDataShape } from "@/contexts/WorkflowGenerator/validators/emptyDataShape";
import { validateTrivialNodes } from "@/contexts/WorkflowGenerator/validators/trivialNode";
import { validateDecisionNodeOutputFormat } from "@/contexts/WorkflowGenerator/validators/decisionNodeOutputFormat";
import {
  applyAIFixes,
  checkAIResponseSanity,
  applyDeterministicCodeGeneration,
  deterministicRepairEmptyDataShape,
} from "@/contexts/WorkflowGenerator/utils/validationUtils";
import { deterministicRepairGroupBoundaries, deterministicRepairPipelineStrategyA } from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";
import type { WorkflowNode } from "@/types";
import type { ValidationResult } from "@/types/ai/validators";
import type { UpdateWorkflowResponse } from "@/types/ai";

// ── Config ────────────────────────────────────────────────────────────────────
const TEST_PROMPT = "2개 페이지로 구성해";
const PDF_PATHS = [
  "/Users/limtae/Downloads/Requirement_Spec.pdf",
  "/Users/limtae/Downloads/PRD.pdf",
];
const MAX_RETRIES = 5;

const openai = new OpenAI({ apiKey: API_KEY });

// ── PDF parse ─────────────────────────────────────────────────────────────────
async function parsePdf(path: string): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const buf = readFileSync(path);
  const result = await pdfParse(buf);
  return result.text as string;
}

// ── Validators ────────────────────────────────────────────────────────────────
interface ValidatorEntry {
  name: string;
  validate: (nodes: WorkflowNode[]) => ValidationResult | Promise<ValidationResult>;
}

const mandatoryValidators: ValidatorEntry[] = [
  { name: "Parent Node Structure", validate: validateParentNodeStructure },
  { name: "Circular References", validate: validateCircularReferences },
  { name: "Circular ParentNode Cycles", validate: validateParentNodeCycles },
  { name: "Start Node Children", validate: validateStartNodeChildren },
  { name: "Sync-Only Nodes", validate: validateSyncOnlyNodes },
  { name: "GroupNode Pipelines", validate: validateGroupNodePipelines },
  { name: "GroupNode Min Children", validate: validateGroupNodeMinChildren },
  { name: "Root GroupNodes", validate: validateRootGroupNodes },
  { name: "functionCode Mismatch", validate: validateFunctionCodeInputData },
  { name: "outputData Type Mismatch", validate: validateOutputDataTypeMismatch },
  { name: "Service Node functionCode", validate: validateServiceNodeFunctionCode },
  { name: "Service Node Simulation", validate: validateServiceNodeSimulation },
  { name: "Service Node Runtime", validate: validateServiceNodeRuntime },
  { name: "Parent-Child Data Flow", validate: validateParentChildDataFlow },
  { name: "Trivial Task Nodes", validate: validateTrivialNodes },
  { name: "FunctionCode Required", validate: validateFunctionCodeRequired },
  { name: "Empty Data Shape", validate: validateEmptyDataShape },
  { name: "Decision Node Output Format", validate: validateDecisionNodeOutputFormat },
];

async function runValidators(
  nodes: WorkflowNode[],
): Promise<{ validatorName: string; result: ValidationResult }[]> {
  const violations: { validatorName: string; result: ValidationResult }[] = [];
  for (const v of mandatoryValidators) {
    try {
      const result = await v.validate(nodes);
      if (!result.valid) violations.push({ validatorName: v.name, result });
    } catch (err) {
      const e = err as Error;
      console.error(`\n💥 Validator "${v.name}" threw: ${e.message}`);
      console.error(e.stack);
      throw err;
    }
  }
  return violations;
}

// ── Display helpers ───────────────────────────────────────────────────────────
function printTree(nodes: WorkflowNode[]): void {
  const lines = nodes.map((n) =>
    `  ${String(n.type ?? "?").padEnd(9)}| id=${String(n.id).padEnd(42)}| parentNode=${String(n.parentNode ?? "null").padEnd(42)}| "${n.data?.title ?? ""}"`
  ).join("\n");
  console.log(`\n${"=".repeat(70)}\n[TREE]\n${lines}\n${"=".repeat(70)}`);
}

function printViolations(
  violations: { validatorName: string; result: ValidationResult }[],
  label = "VIOLATIONS",
): void {
  if (violations.length === 0) {
    console.log(`\n✅ ${label}: No violations!`);
    return;
  }
  console.log(`\n${"=".repeat(70)}\n[${label}] ${violations.length} violation(s)`);
  for (const { validatorName, result } of violations) {
    console.log(`  ❌ ${validatorName}`);
    console.log(`     ${(result.errorMessage ?? "").slice(0, 600)}`);
  }
  console.log("=".repeat(70));
}

// ── populateGroupChildren (mirrors ai.ts) ─────────────────────────────────────
function populateGroupChildren(nodes: WorkflowNode[]): WorkflowNode[] {
  const groupChildren: Record<string, WorkflowNode[]> = {};
  nodes.forEach((n) => {
    if (n.parentNode) {
      if (!groupChildren[n.parentNode]) groupChildren[n.parentNode] = [];
      groupChildren[n.parentNode].push(n);
    }
  });
  return nodes.map((n) =>
    n.type === "group"
      ? {
          ...n,
          data: {
            ...n.data,
            groups: (groupChildren[n.id] ?? []).filter(
              (c) => c.type !== "decision" && c.type !== "group",
            ),
          },
        }
      : n,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Step 1: Parse PDFs
  console.log("\n🚀 Step 1: Parse PDFs...");
  const prdTexts = await Promise.all(PDF_PATHS.map(parsePdf));
  const prdText = prdTexts.join("\n\n---\n\n");
  console.log(`   PDF text length: ${prdText.length} chars`);

  // Step 2: Analyze PRD
  console.log("\n🚀 Step 2: Analyze PRD...");
  const analysisResp = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    instructions: ANALYSIS_SYSTEM_PROMPT,
    input: getAnalysisContent(prdText, TEST_PROMPT),
    text: { format: { type: "json_object" } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisResult = JSON.parse(analysisResp.output_text) as any;
  console.log(`   Pages: ${analysisResult.pages?.map((p: { name: string }) => p.name).join(", ")}`);

  // Step 3: Generate workflow
  console.log("\n🚀 Step 3: Generate workflow...");
  const contexts = buildGenerationContexts({ prompt: TEST_PROMPT, analysisResult });
  const allNodes: WorkflowNode[] = [];
  for (let i = 0; i < contexts.length; i++) {
    console.log(`   Generating page ${i + 1}/${contexts.length}...`);
    const genResp = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      instructions: GENERATION_SYSTEM_PROMPT,
      input: getGenerationContent(TEST_PROMPT, contexts[i]),
      text: { format: { type: "json_object" } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(genResp.output_text) as any;
    allNodes.push(...(parsed.nodes ?? []));
  }
  console.log(`   Generated ${allNodes.length} nodes`);

  // Post-process (mirrors ai.ts pipeline)
  let nodes = populateGroupChildren(allNodes);
  nodes = applyDeterministicCodeGeneration(nodes);
  nodes = deterministicRepairEmptyDataShape(nodes);
  nodes = deterministicRepairGroupBoundaries(nodes);
  nodes = deterministicRepairPipelineStrategyA(nodes);

  printTree(nodes);

  // Step 4: Validate
  console.log("\n🚀 Step 4: Validate...");
  let violations = await runValidators(nodes);
  printViolations(violations, "INITIAL VIOLATIONS");

  // Step 5: Repair loop
  let retryCount = 0;
  while (violations.length > 0 && retryCount < MAX_RETRIES) {
    retryCount++;
    console.log(
      `\n🔧 Repair ${retryCount}/${MAX_RETRIES}: [${violations.map((v) => v.validatorName).join(", ")}]`,
    );

    const directIds = violations.flatMap((v) => v.result.affectedNodes?.map((n) => n.id) ?? []);
    const nodeMapForRepair = new Map(nodes.map((n) => [n.id, n]));
    const parentIds = directIds
      .map((id) => nodeMapForRepair.get(id)?.parentNode)
      .filter((pid): pid is string => typeof pid === "string" && pid.length > 0);
    const allAffectedIds = [...new Set([...directIds, ...parentIds])];
    const batchPrompt = buildBatchRepairPrompt(violations, nodes);

    const repairResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: MODIFICATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: getModificationContent({
            targetNodeIds: allAffectedIds,
            prompt: batchPrompt,
            nodes,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "workflow_edit", schema: buildEditResultSchema() },
      },
    });

    const editResult = JSON.parse(
      repairResp.choices[0].message.content ?? "{}",
    ) as UpdateWorkflowResponse;

    const sanity = checkAIResponseSanity(editResult, nodes, allAffectedIds);
    if (!sanity.valid) {
      console.log(`   ⚠️ Sanity check failed: ${sanity.reason}`);
      continue;
    }

    console.log(`   AI response: update=${editResult.nodes?.update?.length ?? 0} create=${editResult.nodes?.create?.length ?? 0} delete=${editResult.nodes?.delete?.length ?? 0}`);
    nodes = applyAIFixes(nodes, editResult);
    nodes = applyDeterministicCodeGeneration(nodes);
    nodes = deterministicRepairEmptyDataShape(nodes);
    nodes = deterministicRepairGroupBoundaries(nodes);
    nodes = deterministicRepairPipelineStrategyA(nodes);
    violations = await runValidators(nodes);
    printViolations(violations, `AFTER REPAIR ${retryCount}`);
  }

  // Final result
  console.log(`\n${"=".repeat(70)}`);
  if (violations.length === 0) {
    console.log("🎉 SUCCESS! All validators passed.");
    printTree(nodes);
    console.log(`   Total nodes: ${nodes.length}`);
  } else {
    console.log(`❌ FAILED after ${MAX_RETRIES} retries.`);
    console.log(`   Remaining: [${violations.map((v) => v.validatorName).join(", ")}]`);
    printTree(nodes);
  }
  console.log("=".repeat(70));
}

main().catch((e: Error) => {
  console.error("\n💥 Error:", e.message);
  process.exit(1);
});
