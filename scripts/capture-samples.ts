/**
 * Sample data capture script
 *
 * Runs the full analysis + generation + validation pipeline for each PDF scenario
 * and saves the results to src/fixtures/samples/data/{scenario}.json
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/capture-samples.ts fitness
 *   npx tsx --tsconfig tsconfig.json scripts/capture-samples.ts basketball
 *   npx tsx --tsconfig tsconfig.json scripts/capture-samples.ts travel
 *   npx tsx --tsconfig tsconfig.json scripts/capture-samples.ts focus
 */

import OpenAI from "openai";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { v4 as uuid } from "uuid";
import path from "path";

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch { /* rely on environment */ }

import {
  GENERATION_SYSTEM_PROMPT,
  getGenerationContent,
} from "@/fixtures/prompts/generation";
import {
  buildEditResultSchema,
  getModificationContent,
  MODIFICATION_SYSTEM_PROMPT,
  buildBatchRepairPrompt,
} from "@/fixtures/prompts/modification";
import {
  ANALYSIS_SYSTEM_PROMPT,
  getAnalysisContent,
} from "@/fixtures/prompts/analysis";
import { buildGenerationContexts } from "@/ai/utils";

import {
  applyDeterministicCodeGeneration,
  deterministicRepairEmptyDataShape,
  deterministicRepairFunctionCodeMismatch,
  deterministicRepairTrivialDecisionNodes,
  deterministicRepairParentChildDataFlow,
  deterministicRepairDuplicateGroupChildren,
  deterministicRepairInvalidParentNodes,
  applyAIFixes,
  checkAIResponseSanity,
} from "@/contexts/WorkflowGenerator/utils/validationUtils";
import {
  deterministicRepairGroupBoundaries,
  deterministicRepairPipelineStrategyA,
} from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";
import {
  deterministicRepairOutputDataTypeMismatch,
} from "@/contexts/WorkflowGenerator/validators/outputDataTypeMismatch";
import { validateParentNodeStructure } from "@/contexts/WorkflowGenerator/validators/parentNodeStructure";
import { validateCircularReferences, validateParentNodeCycles, deterministicRepairParentNodeCycles } from "@/contexts/WorkflowGenerator/validators/circularReference";
import { validateGroupNodePipelines } from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";
import { validateGroupNodeMinChildren } from "@/contexts/WorkflowGenerator/validators/groupNodeMinChildren";
import { validateRootGroupNodes } from "@/contexts/WorkflowGenerator/validators/rootGroupNode";
import { validateFunctionCodeInputData } from "@/contexts/WorkflowGenerator/validators/functionCodeMismatch";
import { validateOutputDataTypeMismatch } from "@/contexts/WorkflowGenerator/validators/outputDataTypeMismatch";
import { validateServiceNodeFunctionCode } from "@/contexts/WorkflowGenerator/validators/serviceNodeFunctionCode";
import { validateServiceNodeSimulation } from "@/contexts/WorkflowGenerator/validators/serviceNodeSimulation";
import { validateServiceNodeRuntime } from "@/contexts/WorkflowGenerator/validators/serviceNodeRuntime";
import { validateParentChildDataFlow } from "@/contexts/WorkflowGenerator/validators/parentChildDataFlow";
import { validateFunctionCodeRequired } from "@/contexts/WorkflowGenerator/validators/functionCodeRequired";
import { validateEmptyDataShape } from "@/contexts/WorkflowGenerator/validators/emptyDataShape";
import { validateTrivialNodes } from "@/contexts/WorkflowGenerator/validators/trivialNode";
import { validateDecisionNodeOutputFormat } from "@/contexts/WorkflowGenerator/validators/decisionNodeOutputFormat";
import { validateStartNodeChildren } from "@/contexts/WorkflowGenerator/validators/startNodeChild";
import { validateSyncOnlyNodes } from "@/contexts/WorkflowGenerator/validators/syncOnlyNodes";

import type { WorkflowNode, GroupNodeData, ServiceNodeData } from "@/types/nodes";
import type { GenerateWorkflowResponse, UpdateWorkflowResponse } from "@/types/ai";
import type { AnalyzePRDResult } from "@/types/ai/prdAnalysis";
import type { ValidationResult } from "@/types/ai/validators";
import type { TestCase } from "@/types/prd";

// ── Setup ─────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in .env.local");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const PDF_PATHS: Record<string, string[]> = {
  fitness: [path.resolve(__dirname, "pdfs/fitness_diet_app_prd.pdf")],
  focus: [
    path.resolve(__dirname, "pdfs/PRD.pdf"),
    path.resolve(__dirname, "pdfs/Requirement_Spec.pdf"),
  ],
  basketball: [path.resolve(__dirname, "pdfs/basketball_app_prd.pdf")],
  travel: [path.resolve(__dirname, "pdfs/travel_planner_prd.pdf")],
};

const MAX_RETRIES = 12;

// ── PDF reading ───────────────────────────────────────────────────────────────

function readPdfText(filePath: string): string {
  try {
    return execSync(`pdftotext "${filePath}" -`, { encoding: "utf-8" });
  } catch {
    throw new Error(`Failed to read PDF: ${filePath}`);
  }
}

// ── Step 1: Analyze PRD ───────────────────────────────────────────────────────

async function analyzePRDFromText(prdText: string, prompt: string): Promise<AnalyzePRDResult> {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    instructions: ANALYSIS_SYSTEM_PROMPT,
    input: getAnalysisContent(prdText, prompt),
    text: { format: { type: "json_object" } },
  });

  const content = response.output_text;
  if (!content) throw new Error("No response from OpenAI (analyzePRD)");

  const result = JSON.parse(content) as AnalyzePRDResult;
  if (!result.goal || !Array.isArray(result.pages)) {
    throw new Error("Invalid analysis response structure");
  }

  return result;
}

// ── Step 2: Generate nodes ────────────────────────────────────────────────────

async function generatePageNodes(
  prompt: string,
  enrichedPrdText: string | undefined,
  retryCount = 0,
): Promise<WorkflowNode[]> {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    instructions: GENERATION_SYSTEM_PROMPT,
    input: getGenerationContent(prompt, enrichedPrdText),
    text: { format: { type: "json_object" } },
  });

  const content = response.output_text;
  if (!content) throw new Error("No response from OpenAI (generatePageNodes)");

  try {
    const workflow = JSON.parse(content) as GenerateWorkflowResponse;
    return workflow.nodes ?? [];
  } catch (err) {
    if (retryCount < 3 && err instanceof SyntaxError) {
      console.warn(`  ⚠️  JSON parse error (retry ${retryCount + 1}/3)`);
      return generatePageNodes(prompt, enrichedPrdText, retryCount + 1);
    }
    throw err;
  }
}

// ── Post-processing (mirrors ai.ts) ──────────────────────────────────────────

function populateGroupChildren(nodes: WorkflowNode[]): WorkflowNode[] {
  const groupChildren: Record<string, WorkflowNode[]> = {};
  nodes.forEach((node) => {
    if (node.parentNode) {
      if (!groupChildren[node.parentNode]) groupChildren[node.parentNode] = [];
      groupChildren[node.parentNode].push(node);
    }
  });
  return nodes.map((node) => {
    if (node.type === "group") {
      return {
        ...node,
        data: {
          ...node.data,
          groups: (groupChildren[node.id] ?? []).filter(
            (child) => child.type !== "decision" && child.type !== "group",
          ),
        },
      };
    }
    return node;
  });
}

function normalizeNodeDefaults(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.type === "service") {
      const serviceData = node.data as ServiceNodeData;
      const baseData = {
        mode: "panel" as const,
        ...node.data,
        http: {
          method: "POST" as const,
          endpoint: "",
          headers: {},
          body: {},
          ...serviceData.http,
        },
        retry: serviceData.retry ?? { count: 3, delay: 1000 },
        timeout: serviceData.timeout ?? 5000,
      };
      if (node.data.execution?.config) {
        return { ...node, data: { ...baseData, execution: { ...node.data.execution, config: { ...node.data.execution.config } } } };
      }
      return { ...node, data: baseData };
    }
    if (node.type === "group") {
      const hasExecutionConfig = node.data.execution?.config;
      const hasFunctionCode = hasExecutionConfig?.functionCode;
      const existingInputData = node.data.execution?.config?.nodeData?.inputData;
      const existingOutputData = node.data.execution?.config?.nodeData?.outputData;
      const groupData = node.data as GroupNodeData;
      const groups = groupData.groups || [];
      const lastChild = groups[groups.length - 1];
      const lastOutputData = lastChild?.data?.execution?.config?.nodeData?.outputData;
      const effectiveOutputData =
        lastOutputData && typeof lastOutputData === "object" && Object.keys(lastOutputData as object).length > 0
          ? lastOutputData
          : existingOutputData && typeof existingOutputData === "object" && Object.keys(existingOutputData as object).length > 0
            ? existingOutputData
            : null;
      const syncedNodeData = {
        inputData: !node.parentNode ? null : (existingInputData ?? null),
        outputData: effectiveOutputData,
      };
      if (!hasFunctionCode) {
        return { ...node, data: { ...node.data, execution: { ...node.data.execution, config: { ...hasExecutionConfig, functionCode: "// inputData: output from last internal node\nreturn inputData;", nodeData: syncedNodeData, lastModified: Date.now() } } } };
      }
      return { ...node, data: { ...node.data, execution: { ...node.data.execution, config: { ...hasExecutionConfig, nodeData: syncedNodeData } } } };
    }
    return node;
  });
}

function generateDefaultTestCases(node: WorkflowNode): TestCase[] {
  const nodeTitle = node.data?.title || node.type;
  return [
    { id: `test-${uuid()}`, name: "Success case", description: `Test successful execution of ${nodeTitle}`, inputData: {}, expectedOutput: { success: true }, status: "pending" },
    { id: `test-${uuid()}`, name: "Failure case", description: `Test error handling in ${nodeTitle}`, inputData: null, expectedOutput: { success: false, error: "Invalid input" }, status: "pending" },
    { id: `test-${uuid()}`, name: "Edge case", description: `Test boundary conditions in ${nodeTitle}`, inputData: {}, expectedOutput: {}, status: "pending" },
  ];
}

function applyPRDFallbacks(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    if (!node || !node.data) return node;
    return {
      ...node,
      data: {
        ...node.data,
        prdReference: node.data.prdReference || { section: "Unknown", requirement: "Not specified by AI", rationale: "Generated without explicit PRD reference" },
        testCases: (node.data.testCases && node.data.testCases.length >= 3
          ? node.data.testCases
          : generateDefaultTestCases(node)
        ).map((tc) => {
          const nodeDataInput = node.data.execution?.config?.nodeData?.inputData;
          const isEmptyObj = tc.inputData !== null && typeof tc.inputData === "object" && Object.keys(tc.inputData as object).length === 0;
          return { ...tc, id: `test-${uuid()}`, inputData: isEmptyObj && nodeDataInput ? nodeDataInput : tc.inputData };
        }),
      },
    };
  });
}

// ── Update workflow ───────────────────────────────────────────────────────────

async function updateWorkflow(params: { targetNodeIds: string[]; prompt: string; nodes: WorkflowNode[] }): Promise<UpdateWorkflowResponse> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: MODIFICATION_SYSTEM_PROMPT },
      { role: "user", content: getModificationContent(params) },
    ],
    temperature: 0.3,
    response_format: { type: "json_schema", json_schema: { name: "workflow_edit", schema: buildEditResultSchema() } },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI (updateWorkflow)");
  const editResult = JSON.parse(content) as UpdateWorkflowResponse;
  if (!editResult.nodes) throw new Error("Edit result missing nodes");
  if (!editResult.metadata) {
    editResult.metadata = { description: "Workflow modified", affectedNodeIds: [] };
  }
  return editResult;
}

// ── Validation pipeline ───────────────────────────────────────────────────────

interface Validator {
  name: string;
  validate: (nodes: WorkflowNode[]) => ValidationResult | Promise<ValidationResult>;
}

const MANDATORY_VALIDATORS: Validator[] = [
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

async function runValidation(nodes: WorkflowNode[]): Promise<{ violations: { validatorName: string; result: ValidationResult }[] }> {
  const violations: { validatorName: string; result: ValidationResult }[] = [];
  for (const validator of MANDATORY_VALIDATORS) {
    const result = await validator.validate(nodes);
    if (!result.valid) violations.push({ validatorName: validator.name, result });
  }
  return { violations };
}

async function runRepairPipeline(initialNodes: WorkflowNode[]): Promise<WorkflowNode[]> {
  let workingNodes = applyDeterministicCodeGeneration(initialNodes);
  workingNodes = deterministicRepairDuplicateGroupChildren(workingNodes);
  workingNodes = deterministicRepairInvalidParentNodes(workingNodes);
  workingNodes = deterministicRepairParentNodeCycles(workingNodes);
  workingNodes = deterministicRepairEmptyDataShape(workingNodes);
  workingNodes = deterministicRepairGroupBoundaries(workingNodes);
  workingNodes = deterministicRepairPipelineStrategyA(workingNodes);
  workingNodes = deterministicRepairFunctionCodeMismatch(workingNodes);
  workingNodes = deterministicRepairTrivialDecisionNodes(workingNodes);
  workingNodes = await deterministicRepairOutputDataTypeMismatch(workingNodes);
  workingNodes = deterministicRepairParentChildDataFlow(workingNodes);
  workingNodes = deterministicRepairGroupBoundaries(workingNodes);
  workingNodes = applyDeterministicCodeGeneration(workingNodes);

  let { violations } = await runValidation(workingNodes);

  if (violations.length === 0) {
    console.log("  ✅ No violations — generation was clean!");
  } else {
    console.log(`  ⚠️  Initial violations (${violations.length}): [${violations.map(v => v.validatorName).join(", ")}]`);
  }

  let retryCount = 0;

  while (violations.length > 0) {
    const directAffectedIds = violations.flatMap(v => v.result.affectedNodes?.map(n => n.id) ?? []);
    const nodeMap = new Map(workingNodes.map(n => [n.id, n]));
    const parentIds = directAffectedIds.map(id => nodeMap.get(id)?.parentNode).filter((pid): pid is string => typeof pid === "string" && pid.length > 0);
    const allAffectedIds = Array.from(new Set([...directAffectedIds, ...parentIds]));
    const batchPrompt = buildBatchRepairPrompt(violations, workingNodes);

    console.log(`  🔄 Retry #${retryCount + 1} violations: [${violations.map(v => v.validatorName).join(", ")}]`);

    let aiResponse;
    try {
      aiResponse = await updateWorkflow({
        targetNodeIds: allAffectedIds.length > 0 ? allAffectedIds : [workingNodes[0]?.id ?? ""],
        prompt: batchPrompt,
        nodes: workingNodes,
      });
    } catch (err) {
      console.warn(`  ⚠️  AI call failed on retry #${retryCount + 1}: ${String(err)}`);
      retryCount++;
      if (retryCount >= MAX_RETRIES) break;
      continue;
    }

    const sanity = checkAIResponseSanity(aiResponse, workingNodes, allAffectedIds);
    if (!sanity.valid) {
      console.warn(`  ⚠️  Sanity check failed: ${sanity.reason}`);
      retryCount++;
      if (retryCount >= MAX_RETRIES) break;
      continue;
    }

    workingNodes = applyAIFixes(workingNodes, aiResponse);
    workingNodes = applyDeterministicCodeGeneration(workingNodes);
    workingNodes = deterministicRepairDuplicateGroupChildren(workingNodes);
    workingNodes = deterministicRepairInvalidParentNodes(workingNodes);
    workingNodes = deterministicRepairParentNodeCycles(workingNodes);
    workingNodes = deterministicRepairEmptyDataShape(workingNodes);
    workingNodes = deterministicRepairGroupBoundaries(workingNodes);
    workingNodes = deterministicRepairPipelineStrategyA(workingNodes);
    workingNodes = deterministicRepairFunctionCodeMismatch(workingNodes);
    workingNodes = deterministicRepairTrivialDecisionNodes(workingNodes);
    workingNodes = await deterministicRepairOutputDataTypeMismatch(workingNodes);
    workingNodes = deterministicRepairParentChildDataFlow(workingNodes);
    workingNodes = deterministicRepairGroupBoundaries(workingNodes);
    workingNodes = applyDeterministicCodeGeneration(workingNodes);

    violations = (await runValidation(workingNodes)).violations;

    retryCount++;
    if (retryCount >= MAX_RETRIES && violations.length > 0) {
      throw new Error(`[Mandatory] Max retries (${MAX_RETRIES}) reached with ${violations.length} violation(s) remaining: ${violations.map(v => v.validatorName)}`);
    }
  }

  return workingNodes;
}

// ── Main capture logic ────────────────────────────────────────────────────────

async function captureScenario(scenario: string): Promise<void> {
  const pdfPaths = PDF_PATHS[scenario];
  if (!pdfPaths) {
    console.error(`Unknown scenario: ${scenario}. Available: ${Object.keys(PDF_PATHS).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Capturing scenario: ${scenario}`);
  console.log(`PDFs: ${pdfPaths.join(", ")}`);
  console.log(`${"=".repeat(60)}\n`);

  // Read PDFs
  const pdfTexts = pdfPaths.map(p => readPdfText(p));
  const combinedPdfText = pdfTexts.join("\n\n---\n\n");

  // Step 1: Analyze
  console.log("Step 1: Analyzing PRD...");
  const analysisResult = await analyzePRDFromText(combinedPdfText, "");
  console.log(`  ✅ Found ${analysisResult.pages.length} page(s): ${analysisResult.pages.map(p => p.name).join(", ")}`);

  // Step 2: Generate nodes per page
  console.log("\nStep 2: Generating nodes...");
  const contexts = buildGenerationContexts({ prompt: "", analysisResult });
  let allNodes: WorkflowNode[] = [];

  for (let i = 0; i < contexts.length; i++) {
    const enrichedPrdText = contexts[i];
    console.log(`  Page ${i + 1}/${contexts.length}: ${analysisResult.pages[i]?.name}`);
    let pageNodes = await generatePageNodes("", enrichedPrdText);
    pageNodes = populateGroupChildren(pageNodes);
    pageNodes = normalizeNodeDefaults(pageNodes);
    pageNodes = applyDeterministicCodeGeneration(pageNodes);
    pageNodes = deterministicRepairEmptyDataShape(pageNodes);
    pageNodes = deterministicRepairGroupBoundaries(pageNodes);
    pageNodes = deterministicRepairPipelineStrategyA(pageNodes);
    pageNodes = applyPRDFallbacks(pageNodes);
    allNodes = [...allNodes, ...pageNodes];
    console.log(`    Generated ${pageNodes.length} nodes`);
  }

  // Step 3: Validate + repair per tree
  console.log("\nStep 3: Validating and repairing...");

  // Split into trees by start node
  function splitIntoTrees(nodes: WorkflowNode[]): WorkflowNode[][] {
    const startNodes = nodes.filter(n => n.type === "start");
    if (startNodes.length <= 1) return [nodes];

    const trees: WorkflowNode[][] = [];
    for (const startNode of startNodes) {
      const reachableIds = new Set<string>();
      const queue = [startNode.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (reachableIds.has(id)) continue;
        reachableIds.add(id);
        const node = nodes.find(n => n.id === id);
        if (!node) continue;
        nodes.filter(n => n.parentNode === id).forEach(c => queue.push(c.id));
      }
      trees.push(nodes.filter(n => reachableIds.has(n.id) || (!n.parentNode && n.type !== "start" && trees.length === 0)));
    }
    return trees.length > 0 ? trees : [nodes];
  }

  const trees = splitIntoTrees(allNodes);
  const allValidatedNodes: WorkflowNode[] = [];

  for (let i = 0; i < trees.length; i++) {
    console.log(`  Tree ${i + 1}/${trees.length} (${trees[i].length} nodes)...`);
    const validated = await runRepairPipeline(trees[i]);
    allValidatedNodes.push(...validated);
    console.log(`    ✅ Validated (${validated.length} nodes)`);
  }

  // Final passes
  let finalNodes = applyDeterministicCodeGeneration(allValidatedNodes);
  finalNodes = deterministicRepairEmptyDataShape(finalNodes);

  // Verify final state
  const { violations: finalViolations } = await runValidation(finalNodes);
  if (finalViolations.length > 0) {
    console.warn(`\n⚠️  ${finalViolations.length} violations remain after capture:`);
    finalViolations.forEach(v => console.warn(`  - ${v.validatorName}: ${v.result.errorMessage}`));
  } else {
    console.log("\n  ✅ All validators pass!");
  }

  // Save to fixture file
  const outputDir = path.resolve(process.cwd(), "src/fixtures/samples/data");
  mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${scenario}.json`);
  const output = {
    capturedAt: new Date().toISOString(),
    scenario,
    analysisResult,
    nodes: finalNodes,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n✅ Saved to ${outputPath}`);
  console.log(`   Analysis: ${analysisResult.pages.length} pages`);
  console.log(`   Nodes: ${finalNodes.length}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const scenario = process.argv[2];
if (!scenario) {
  console.error("Usage: npx tsx --tsconfig tsconfig.json scripts/capture-samples.ts <scenario>");
  console.error("Scenarios: " + Object.keys(PDF_PATHS).join(", "));
  process.exit(1);
}

captureScenario(scenario).catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
