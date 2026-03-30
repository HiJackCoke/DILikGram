/**
 * test-ui-generation.ts
 *
 * 실제 OpenAI API를 호출해 generateUIAction의 결과물이
 * 모든 완료 조건을 충족하는지 검증하는 테스트 스크립트.
 *
 * 실행: npx tsx --tsconfig tsconfig.json scripts/test-ui-generation.ts
 */

// Load .env.local manually
import { readFileSync } from "fs";
try {
  const envContent = readFileSync(".env.local", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* ignore */ }

import OpenAI from "openai";
import basketballData from "../src/fixtures/samples/data/basketball.json";
import { UI_GENERATION_SYSTEM_PROMPT, getUIGenerationContent } from "../src/fixtures/prompts/uiGeneration";
import type { WorkflowNode, ServiceNodeData } from "../src/types/nodes";
import type { UIComponent } from "../src/types/ai/uiGeneration";
import type { AnalyzePRDResult } from "../src/types/ai/prdAnalysis";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UIPageContext {
  pageName: string;
  pagePath?: string;
  goal: string;
  features: Array<{ name: string; description: string; priority: "must" | "should" | "could" }>;
  nodeFlow?: string;
  dataFields: string[];
  endpoints: Array<{ method: string; endpoint: string }>;
}

interface ValidationResult {
  pageName: string;
  totalWorkflowNodes: number;
  totalComponents: number;
  violations: string[];
  componentList: Array<{ key: string; name: string; nodeIds: string[]; type: "single" | "combined" | "phantom" }>;
  uncoveredNodes: string[];
  passed: boolean;
}

// ─── Helpers (mirrors ai.ts logic) ──────────────────────────────────────────

function compactShape(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${compactShape(value[0], depth + 1)}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (depth >= 1 || keys.length <= 4) {
      const pairs = keys.slice(0, 6).map((k) => {
        const v = (value as Record<string, unknown>)[k];
        if (typeof v === "object" && v !== null) return k;
        return `${k}: ${JSON.stringify(v)}`;
      }).join(", ");
      return `{${pairs}${keys.length > 6 ? ", ..." : ""}}`;
    }
    return `{${keys.slice(0, 8).join(", ")}${keys.length > 8 ? ", ..." : ""}}`;
  }
  return JSON.stringify(value);
}

function computePreGroupedComponents(nodes: WorkflowNode[]): Array<{ componentKey: string; componentName: string; nodeIds: string[] }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentNode && nodeMap.has(node.parentNode)) {
      if (!childrenOf.has(node.parentNode)) childrenOf.set(node.parentNode, []);
      childrenOf.get(node.parentNode)!.push(node.id);
    }
  }
  const usedKeys = new Set<string>();
  const assignedIds = new Set<string>();
  const result: Array<{ componentKey: string; componentName: string; nodeIds: string[] }> = [];

  function toKey(title: string): string {
    const base = title.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean)
      .map((w, i) => i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1)).join("") || "component";
    let key = base; let suffix = 2;
    while (usedKeys.has(key)) key = `${base}${suffix++}`;
    usedKeys.add(key); return key;
  }

  // Pass 1: group nodes absorb all their direct children
  for (const node of nodes) {
    if (node.type === "group" && !assignedIds.has(node.id)) {
      const children = (childrenOf.get(node.id) ?? []).filter((id) => !assignedIds.has(id));
      const nodeIds = [node.id, ...children];
      nodeIds.forEach((id) => assignedIds.add(id));
      const title = node.data.title ?? node.id;
      result.push({ componentKey: toKey(title), componentName: title, nodeIds });
    }
  }

  // Pass 2: parent orchestrator nodes → absorb into first child group component
  for (const node of nodes) {
    if (assignedIds.has(node.id)) continue;
    const myChildren = childrenOf.get(node.id) ?? [];
    const targetGroup = result.find((comp) => comp.nodeIds.some((id) => myChildren.includes(id)));
    if (targetGroup) {
      targetGroup.nodeIds.unshift(node.id);
      assignedIds.add(node.id);
    }
  }

  // Pass 3: truly isolated nodes → standalone component
  for (const node of nodes) {
    if (!assignedIds.has(node.id)) {
      assignedIds.add(node.id);
      const title = node.data.title ?? node.id;
      result.push({ componentKey: toKey(title), componentName: title, nodeIds: [node.id] });
    }
  }
  return result;
}

function buildNodeFlow(
  page: AnalyzePRDResult["pages"][number],
  pageIndex: number,
  nodes: WorkflowNode[],
): { flow: string; pageNodeIds: Set<string>; requiredComponents: ReturnType<typeof computePreGroupedComponents> } {
  const sectionAliases = new Set([page.name, page.name.toLowerCase(), `p${pageIndex + 1}`]);

  let pageNodes = nodes.filter((n) => {
    const section = n.data.prdReference?.section;
    return section && sectionAliases.has(section);
  });

  if (pageNodes.length === 0) {
    const idPrefix = `p${pageIndex + 1}-`;
    pageNodes = nodes.filter((n) => n.id.startsWith(idPrefix));
  }

  if (pageNodes.length === 0) {
    const startNode = nodes.find(
      (n) => n.type === "start" && (n as unknown as { siblingIndex?: number }).siblingIndex === pageIndex,
    );
    if (startNode) {
      const descendantIds = new Set<string>();
      const queue = [startNode.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (descendantIds.has(id)) continue;
        descendantIds.add(id);
        for (const n of nodes) {
          if (n.parentNode === id && !descendantIds.has(n.id)) queue.push(n.id);
        }
      }
      pageNodes = nodes.filter((n) => descendantIds.has(n.id));
    }
  }

  if (pageNodes.length === 0) return { flow: "", pageNodeIds: new Set(), requiredComponents: [] };

  const meaningfulNodes = pageNodes.filter((n) => n.type !== "start" && n.type !== "end");
  const pageNodeIds = new Set(meaningfulNodes.map((n) => n.id));

  const lines: string[] = [];
  for (const node of meaningfulNodes) {
    const nodeData = node.data.execution?.config?.nodeData;
    const outputData = nodeData?.outputData;
    const functionCode = node.data.execution?.config?.functionCode;
    const prdReq = node.data.prdReference?.requirement;

    lines.push(`[${node.type}] ${node.data.title} (nodeId: ${node.id})`);
    if (prdReq) lines.push(`  PRD: "${prdReq}"`);
    if (node.type === "service") {
      const http = (node.data as ServiceNodeData).http;
      if (http?.endpoint) lines.push(`  → ${http.method ?? "POST"} ${http.endpoint}`);
    }
    if (outputData && typeof outputData === "object") lines.push(`  → outputData: ${compactShape(outputData)}`);
    if (node.type === "task" && functionCode && typeof functionCode === "string") {
      const summary = functionCode.replace(/\s+/g, " ").trim().slice(0, 100);
      lines.push(`  → logic: ${summary}${functionCode.length > 100 ? "..." : ""}`);
    }
  }

  // Build parent-child hierarchy
  const nodeMapLocal = new Map(meaningfulNodes.map((n) => [n.id, n]));
  const hierarchyLines: string[] = [];
  const topLevel = meaningfulNodes.filter((n) => !n.parentNode || !nodeMapLocal.has(n.parentNode));
  function printHierarchy(nodeId: string, depth: number): void {
    const node = nodeMapLocal.get(nodeId);
    if (!node) return;
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "●" : "└─";
    hierarchyLines.push(`${indent}${prefix} [${node.type}] ${node.data.title ?? nodeId} (${nodeId})`);
    const children = meaningfulNodes.filter((n) => n.parentNode === nodeId);
    for (const child of children) printHierarchy(child.id, depth + 1);
  }
  for (const n of topLevel) printHierarchy(n.id, 0);

  const requiredComponents = computePreGroupedComponents(meaningfulNodes);
  const requiredJson = JSON.stringify(requiredComponents, null, 2);
  const flow =
    lines.join("\n") +
    (hierarchyLines.length > 0
      ? `\n\nNode Hierarchy (shows data/state flow — use this to understand which nodes work together):\n${hierarchyLines.join("\n")}`
      : "") +
    `\n\n📋 AVAILABLE node IDs for @dg-components:\n` +
    `RULE: Only create a named component for nodes that produce DIRECTLY VISIBLE, SELECTABLE UI.\n` +
    `Suggested grouping (parent orchestrator absorbed into first child group):\n${requiredJson}`;

  return { flow, pageNodeIds, requiredComponents };
}

function parseUIOutput(raw: string, pageNodeIds: Set<string>): { code: string; components: UIComponent[] } {
  const stripped = raw
    .replace(/^```(?:jsx?|tsx?|javascript)?\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  const metaMatch = stripped.match(/\/\*\s*@dg-components\s*([\s\S]*?)\*\//);
  let components: UIComponent[] = [];
  let code = stripped;

  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1].trim()) as UIComponent[];
      components = parsed.map((comp) => ({
        ...comp,
        nodeIds: pageNodeIds.size > 0 ? comp.nodeIds.filter((id) => pageNodeIds.has(id)) : comp.nodeIds,
      }));
    } catch { /* ignore */ }
    code = stripped.replace(/\/\*\s*@dg-components[\s\S]*?\*\//, "").trim();
  }

  return { code, components };
}

function validateUICode(code: string, components: UIComponent[], pageNodeIds: Set<string>): string[] {
  const violations: string[] = [];

  // 1. All pageNodeIds covered
  if (pageNodeIds.size > 0) {
    const coveredIds = new Set(components.flatMap((c) => c.nodeIds));
    const uncovered = [...pageNodeIds].filter((id) => !coveredIds.has(id));
    if (uncovered.length > 0) {
      violations.push(`UNCOVERED_NODES: [${uncovered.join(", ")}]`);
    }
  }

  // 2. No phantom components
  if (pageNodeIds.size > 0) {
    const phantoms = components.filter((c) => c.nodeIds.length === 0);
    if (phantoms.length > 0) {
      violations.push(`PHANTOM_COMPONENTS: [${phantoms.map((c) => c.componentKey).join(", ")}]`);
    }
  }

  // 3. No duplicate nodeId across components
  const nodeIdOwners = new Map<string, string[]>();
  for (const comp of components) {
    for (const id of comp.nodeIds) {
      if (!nodeIdOwners.has(id)) nodeIdOwners.set(id, []);
      nodeIdOwners.get(id)!.push(comp.componentKey);
    }
  }
  for (const [id, owners] of nodeIdOwners) {
    if (owners.length > 1) {
      violations.push(`DUPLICATE_NODE_MAPPING: "${id}" used by [${owners.join(", ")}]`);
    }
  }

  // 4. data-dg-component inside App()
  const appStart = code.indexOf("function App(");
  if (appStart !== -1) {
    let depth = 0, inApp = false, appBody = "";
    for (let i = appStart; i < code.length; i++) {
      if (code[i] === "{") { depth++; inApp = true; }
      else if (code[i] === "}") {
        depth--;
        if (inApp && depth === 0) { appBody = code.slice(appStart, i + 1); break; }
      }
    }
    const dgInApp = appBody.match(/data-dg-component=["'][^"']+["']/g);
    if (dgInApp) violations.push(`DATA_DG_IN_APP: [${dgInApp.join(", ")}]`);
  }

  // 5. Named function + data-dg-component attr per component
  for (const comp of components) {
    if (comp.nodeIds.length === 0) continue;
    const key = comp.componentKey;
    const pascal = key.charAt(0).toUpperCase() + key.slice(1);
    if (!code.includes(`function ${pascal}(`)) {
      violations.push(`MISSING_FN: function ${pascal}() not found for key "${key}"`);
    }
    if (!new RegExp(`data-dg-component=["']${key}["']`).test(code)) {
      violations.push(`MISSING_DG_ATTR: data-dg-component="${key}" not found`);
    }
  }

  return violations;
}

function buildCorrectionPrompt(
  violations: string[],
  previousCode: string,
  nodeFlow: string,
  requiredComponents: ReturnType<typeof computePreGroupedComponents>,
): string {
  const requiredJson = JSON.stringify(requiredComponents, null, 2);
  return `Your React code has ${violations.length} violation(s) that MUST ALL be fixed:

${violations.map((v, i) => `${i + 1}. ${v}`).join("\n\n")}

━━━ REQUIRED @dg-components — USE THIS EXACTLY ━━━
Each componentKey below MUST have:
  1. A named function: function PascalCaseKey(...) { ... } defined BEFORE App()
  2. data-dg-component="componentKey" on the ROOT element of that function
  3. NOT inside function App()

${requiredJson}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Previous code:
\`\`\`
${previousCode}
\`\`\`

Workflow nodes reference:
${nodeFlow}

Output COMPLETE corrected code: all component functions → function App() → @dg-components block.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function testPage(
  openai: OpenAI,
  page: AnalyzePRDResult["pages"][number],
  pageIndex: number,
  nodes: WorkflowNode[],
  goal: string,
): Promise<ValidationResult> {
  const { flow: nodeFlow, pageNodeIds, requiredComponents } = buildNodeFlow(page, pageIndex, nodes);

  const ctx: UIPageContext = {
    pageName: page.name,
    pagePath: page.path,
    goal,
    features: page.features,
    nodeFlow: nodeFlow || undefined,
    dataFields: [],
    endpoints: [],
  };

  console.log(`\n${"─".repeat(60)}`);
  console.log(`📄 Page: "${page.name}" — ${pageNodeIds.size} workflow nodes`);
  console.log(`${"─".repeat(60)}`);

  // Initial generation
  console.log(`  [1] Generating UI...`);
  const firstResponse = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    instructions: UI_GENERATION_SYSTEM_PROMPT,
    input: getUIGenerationContent(ctx as Parameters<typeof getUIGenerationContent>[0]),
  });

  let { code, components } = parseUIOutput(firstResponse.output_text ?? "", pageNodeIds);

  // Correction loop (up to 3 retries)
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const violations = validateUICode(code, components, pageNodeIds);
    if (violations.length === 0) {
      console.log(`  ✅ Passed on attempt ${attempt + 1}`);
      break;
    }

    console.log(`  ⚠️  Attempt ${attempt + 1} — ${violations.length} violation(s):`);
    violations.forEach((v) => console.log(`     · ${v}`));

    if (attempt === MAX_RETRIES - 1) {
      console.log(`  ❌ Still failing after ${MAX_RETRIES} attempts`);
      break;
    }

    console.log(`  [${attempt + 2}] Sending correction...`);
    const correctionResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      instructions: UI_GENERATION_SYSTEM_PROMPT,
      input: buildCorrectionPrompt(violations, code, nodeFlow, requiredComponents),
    });

    const corrected = parseUIOutput(correctionResponse.output_text ?? "", pageNodeIds);
    code = corrected.code;
    components = corrected.components;
  }

  // Final validation
  const finalViolations = validateUICode(code, components, pageNodeIds);
  const coveredIds = new Set(components.flatMap((c) => c.nodeIds));
  const uncoveredNodes = [...pageNodeIds].filter((id) => !coveredIds.has(id));

  const componentList = components.map((c) => ({
    key: c.componentKey,
    name: c.componentName,
    nodeIds: c.nodeIds,
    type: (c.nodeIds.length === 0 ? "phantom" : c.nodeIds.length > 1 ? "combined" : "single") as "single" | "combined" | "phantom",
  }));

  return {
    pageName: page.name,
    totalWorkflowNodes: pageNodeIds.size,
    totalComponents: components.length,
    violations: finalViolations,
    componentList,
    uncoveredNodes,
    passed: finalViolations.length === 0,
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY not set in .env.local");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  const sample = basketballData as unknown as {
    analysisResult: AnalyzePRDResult;
    nodes: WorkflowNode[];
  };

  const { analysisResult, nodes } = sample;
  const results: ValidationResult[] = [];

  console.log(`\n${"═".repeat(60)}`);
  console.log(`🏀 Testing: Basketball App (${analysisResult.pages.length} pages)`);
  console.log(`${"═".repeat(60)}`);

  for (const [i, page] of analysisResult.pages.entries()) {
    const result = await testPage(openai, page, i, nodes, analysisResult.goal);
    results.push(result);
  }

  // ─── Final Report ─────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 FINAL REPORT`);
  console.log(`${"═".repeat(60)}`);

  let allPassed = true;

  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`\n${status}  "${r.pageName}"`);
    console.log(`  Workflow nodes: ${r.totalWorkflowNodes} | Components: ${r.totalComponents}`);

    const singles = r.componentList.filter((c) => c.type === "single");
    const combined = r.componentList.filter((c) => c.type === "combined");
    const phantoms = r.componentList.filter((c) => c.type === "phantom");

    if (singles.length > 0) {
      console.log(`  [Implemented - single] ${singles.length} components`);
      singles.forEach((c) => console.log(`    · ${c.key} → ${c.nodeIds[0]}`));
    }
    if (combined.length > 0) {
      console.log(`  [Combined] ${combined.length} components`);
      combined.forEach((c) => console.log(`    · ${c.key} → [${c.nodeIds.join(", ")}]`));
    }
    if (phantoms.length > 0) {
      console.log(`  [Phantom ⚠️] ${phantoms.length} components`);
      phantoms.forEach((c) => console.log(`    · ${c.key}`));
    }
    if (r.uncoveredNodes.length > 0) {
      console.log(`  [Uncovered nodes ⚠️] ${r.uncoveredNodes.length}`);
      r.uncoveredNodes.forEach((id) => console.log(`    · ${id}`));
    }
    if (r.violations.length > 0) {
      console.log(`  [Violations]`);
      r.violations.forEach((v) => console.log(`    · ${v}`));
    }

    if (!r.passed) allPassed = false;
  }

  console.log(`\n${"═".repeat(60)}`);
  if (allPassed) {
    console.log(`✅ ALL PAGES PASSED — 모든 완료 조건 충족`);
  } else {
    console.log(`❌ SOME PAGES FAILED — 아래 위반 사항을 프롬프트/검증 로직에서 수정 필요`);
  }
  console.log(`${"═".repeat(60)}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
