"use server";

/**
 * Server Actions for AI-powered workflow operations
 *
 * Security: API calls are made server-side with environment variable API key
 * All functions use Next.js Server Actions pattern
 */

import OpenAI from "openai";
import { v4 as uuid } from "uuid";
import type {
  GenerateWorkflowAction,
  GenerateWorkflowResponse,
  UpdateWorkflowAction,
  UpdateWorkflowResponse,
} from "@/types/ai";
import type {
  WorkflowNode,
  GroupNodeData,
  ServiceNodeData,
} from "@/types/nodes";
import type { TestCase } from "@/types/prd";

import {
  GENERATION_SYSTEM_PROMPT,
  getGenerationContent,
} from "@/fixtures/prompts/generation";
import {
  buildEditResultSchema,
  getModificationContent,
  MODIFICATION_SYSTEM_PROMPT,
} from "@/fixtures/prompts/modification";

import {
  buildGenerationContexts,
  getOpenAIClient,
  handleOpenAIError,
} from "@/ai";
import {
  applyDeterministicCodeGeneration,
  deterministicRepairEmptyDataShape,
} from "@/contexts/WorkflowGenerator/utils/validationUtils";
import {
  deterministicRepairGroupBoundaries,
  deterministicRepairPipelineStrategyA,
} from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";

/**
 * Generate workflow from prompt using GPT-4o-mini
 *
 * @param prompt - User's workflow description
 * @param nodeLibrary - Optional array of reusable node templates
 * @param analysisResult - Optional PRD analysis result from analyzePRD step
 * @returns Generated workflow with nodes and metadata
 */
export const generateWorkflowAction: GenerateWorkflowAction = async ({
  prompt,
  analysisResult,
}) => {
  // if (!prompt || !prompt.trim()) {
  //   throw new Error("Workflow description is required");
  // }

  try {
    const openai = getOpenAIClient();

    const contexts = buildGenerationContexts({
      prompt,
      analysisResult,
    });
    const allNodes: WorkflowNode[] = [];

    for (let i = 0; i < contexts.length; i++) {
      if (contexts.length > 1) {
        console.log(
          `[generateWorkflowAction] Generating page ${i + 1}/${contexts.length}: ${analysisResult!.pages[i].name}`,
        );
      }
      const nodes = await generatePageNodes(openai, prompt, contexts[i]);
      allNodes.push(...nodes);
    }

    assertNodesValid(allNodes);

    let nodes = populateGroupChildren(allNodes);

    nodes = normalizeNodeDefaults(nodes);
    nodes = applyDeterministicCodeGeneration(nodes);
    nodes = deterministicRepairEmptyDataShape(nodes);
    nodes = deterministicRepairGroupBoundaries(nodes);
    nodes = deterministicRepairPipelineStrategyA(nodes);
    nodes = applyPRDFallbacks(nodes);

    return {
      nodes,
      metadata: {
        description: "",
        estimatedComplexity: "simple",
        prdSummary: undefined,
        reusedNodes: undefined,
      },
    };
  } catch (error) {
    handleOpenAIError(error);
  }
};

// ============================================================================
// PRIVATE HELPERS (generateWorkflowAction — post-processing pipeline)
// ============================================================================

function assertNodesValid(nodes: WorkflowNode[]): void {
  if (!nodes || !Array.isArray(nodes))
    throw new Error("Generated workflow missing nodes array");
  if (nodes.length === 0)
    throw new Error(
      "AI returned an empty workflow. Please try again with a more specific prompt.",
    );
}

/** Populate GroupNode.data.groups from child nodes (Task/Service only; Decision excluded). */
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

/** Apply type-specific defaults: ServiceNode http/retry/timeout, GroupNode functionCode. */
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
        return {
          ...node,
          data: {
            ...baseData,
            execution: {
              ...node.data.execution,
              config: {
                ...node.data.execution.config,
              },
            },
          },
        };
      }

      return { ...node, data: baseData };
    }

    if (node.type === "group") {
      const hasExecutionConfig = node.data.execution?.config;
      const hasFunctionCode = hasExecutionConfig?.functionCode;
      const existingInputData =
        node.data.execution?.config?.nodeData?.inputData;
      const existingOutputData =
        node.data.execution?.config?.nodeData?.outputData;

      const groupData = node.data as GroupNodeData;
      const groups = groupData.groups || [];
      const lastChild = groups[groups.length - 1];
      const lastOutputData =
        lastChild?.data?.execution?.config?.nodeData?.outputData;

      // Issue 1: root group nodes must have inputData: null (key present, not missing)
      // Issue 4: always sync group boundary to last child's outputData
      // Use last child's outputData when available; fall back to existing; use null (not {})
      // {} would fail Empty Data Shape validator since empty objects cannot be type-inferred
      const effectiveOutputData =
        lastOutputData &&
        typeof lastOutputData === "object" &&
        Object.keys(lastOutputData as object).length > 0
          ? lastOutputData
          : existingOutputData &&
              typeof existingOutputData === "object" &&
              Object.keys(existingOutputData as object).length > 0
            ? existingOutputData
            : null;

      const syncedNodeData = {
        inputData: !node.parentNode ? null : (existingInputData ?? null),
        outputData: effectiveOutputData,
      };

      if (!hasFunctionCode) {
        console.warn(
          `GroupNode ${node.id} missing functionCode. Injecting default: "return inputData;"`,
        );

        return {
          ...node,
          data: {
            ...node.data,
            execution: {
              ...node.data.execution,
              config: {
                ...hasExecutionConfig,
                functionCode:
                  "// inputData: output from last internal node\nreturn inputData;",
                nodeData: syncedNodeData,
                lastModified: Date.now(),
              },
            },
          },
        };
      } else {
        // functionCode exists: keep it, but always sync boundary nodeData
        return {
          ...node,
          data: {
            ...node.data,
            execution: {
              ...node.data.execution,
              config: {
                ...hasExecutionConfig,
                nodeData: syncedNodeData,
              },
            },
          },
        };
      }
    }

    return node;
  });
}

/** Add placeholder prdReference and default testCases to all nodes. */
function applyPRDFallbacks(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      prdReference: node.data.prdReference || {
        section: "Unknown",
        requirement: "Not specified by AI",
        rationale: "Generated without explicit PRD reference",
      },
      testCases: (node.data.testCases && node.data.testCases.length >= 3
        ? node.data.testCases
        : generateDefaultTestCases(node)
      ).map((tc) => {
        const nodeDataInput = node.data.execution?.config?.nodeData?.inputData;
        const isEmptyObj =
          tc.inputData !== null &&
          typeof tc.inputData === "object" &&
          Object.keys(tc.inputData as object).length === 0;
        return {
          ...tc,
          id: `test-${uuid()}`,
          inputData: isEmptyObj && nodeDataInput ? nodeDataInput : tc.inputData,
        };
      }),
    },
  }));
}

/**
 * Call OpenAI once for the given context and return the parsed nodes array.
 */
async function generatePageNodes(
  openai: OpenAI,
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
  if (!content) throw new Error("No response from OpenAI");

  try {
    const workflow = JSON.parse(content) as GenerateWorkflowResponse;
    return workflow.nodes ?? [];
  } catch (err) {
    // JSON parse error: response was likely truncated (hit token limit). Retry up to 3 times.
    if (retryCount < 3 && err instanceof SyntaxError) {
      return generatePageNodes(openai, prompt, enrichedPrdText, retryCount + 1);
    }
    throw err;
  }
}

/**
 * Generate default test cases for a node when AI doesn't provide them
 *
 * @param node - The workflow node
 * @returns Array of 3 default test cases
 */
function generateDefaultTestCases(node: WorkflowNode): TestCase[] {
  const nodeTitle = node.data?.title || node.type;

  return [
    {
      id: `test-${uuid()}`,
      name: "Success case",
      description: `Test successful execution of ${nodeTitle}`,
      inputData: {},
      expectedOutput: { success: true },
      status: "pending",
    },
    {
      id: `test-${uuid()}`,
      name: "Failure case",
      description: `Test error handling in ${nodeTitle}`,
      inputData: null,
      expectedOutput: { success: false, error: "Invalid input" },
      status: "pending",
    },
    {
      id: `test-${uuid()}`,
      name: "Edge case",
      description: `Test boundary conditions in ${nodeTitle}`,
      inputData: {},
      expectedOutput: {},
      status: "pending",
    },
  ];
}

/**
 * Update workflow using GPT-4o-mini with incremental edits
 *
 * @param nodeIds - Target node IDs to edit
 * @param prompt - User's edit instructions
 * @param nodes - Current workflow nodes
 * @returns Incremental edit operations (update/create/delete)
 */
export const updateWorkflowAction: UpdateWorkflowAction = async ({
  targetNodeIds,
  prompt,
  nodes,
}) => {
  if (!prompt || !prompt.trim()) {
    throw new Error("Edit description is required");
  }

  if (!targetNodeIds.length) {
    throw new Error("Node ID is required");
  }

  try {
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MODIFICATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: getModificationContent({ targetNodeIds, prompt, nodes }),
        },
      ],
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "workflow_edit",
          schema: buildEditResultSchema(),
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const editResult = JSON.parse(content) as UpdateWorkflowResponse;

    // Validation
    if (!editResult.nodes) {
      console.error("OpenAI response:", editResult);
      throw new Error("Edit result missing nodes. Check server logs.");
    }

    // Generate fallback metadata if missing
    if (!editResult.metadata) {
      console.warn("OpenAI did not return metadata:", editResult);

      const affectedNodeIds = new Set<string>();
      editResult.nodes?.update?.forEach((op) => affectedNodeIds.add(op.id));
      editResult.nodes?.create?.forEach((node) => affectedNodeIds.add(node.id));
      editResult.nodes?.delete?.forEach((id) => affectedNodeIds.add(id));

      editResult.metadata = {
        description: "Workflow modified (metadata not provided by AI)",
        affectedNodeIds: Array.from(affectedNodeIds),
      };
    }

    return editResult;
  } catch (error) {
    handleOpenAIError(error);
  }
};

// ─── UI Preview Generation ────────────────────────────────────────────────────

import type {
  GenerateUIActionParams,
  GenerateUIResponse,
  GeneratedUIPage,
  UIComponent,
} from "@/types/ai/uiGeneration";
import type { AnalyzePRDResult } from "@/types/ai/prdAnalysis";
import { getUIPreviewBySampleId } from "@/fixtures/uiPreviews";
import {
  UI_GENERATION_SYSTEM_PROMPT,
  getUIGenerationContent,
  type UIPageContext,
} from "@/fixtures/prompts/uiGeneration";

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Compact a value for display in nodeFlow:
 * - Arrays: show shape of first element only → [{field1, field2, ...}]
 * - Objects: show keys inline → {field1, field2, ...}
 * - Primitives: show as-is
 */
function compactShape(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const item = value[0];
    return `[${compactShape(item, depth + 1)}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    if (depth >= 1 || keys.length <= 4) {
      // Show key:value pairs for shallow objects
      const pairs = keys
        .slice(0, 6)
        .map((k) => {
          const v = (value as Record<string, unknown>)[k];
          if (typeof v === "object" && v !== null) return k;
          return `${k}: ${JSON.stringify(v)}`;
        })
        .join(", ");
      return `{${pairs}${keys.length > 6 ? ", ..." : ""}}`;
    }
    return `{${keys.slice(0, 8).join(", ")}${keys.length > 8 ? ", ..." : ""}}`;
  }
  return JSON.stringify(value);
}

/**
 * Build a structured nodeFlow string for one page.
 * Filters nodes belonging to this page via prdReference.section,
 * then formats each node's type, title, PRD requirement, outputData shape,
 * and (for task nodes) a brief functionCode summary.
 */
function buildNodeFlow(
  page: AnalyzePRDResult["pages"][number],
  pageIndex: number,
  nodes: WorkflowNode[],
): { flow: string; pageNodeIds: Set<string>; requiredComponents: Array<{ componentKey: string; componentName: string; nodeIds: string[] }> } {
  const sectionAliases = new Set([
    page.name,
    page.name.toLowerCase(),
    `p${pageIndex + 1}`,
  ]);

  // Primary: check prdReference.section at data level; skip "Unknown" sentinel,
  // then fall back to the top-level prdReference (some generators write it there).
  let pageNodes = nodes.filter((n) => {
    const dataSection = n.data.prdReference?.section;
    const nodeSection = (n as unknown as { prdReference?: { section?: string } })
      .prdReference?.section;
    const section =
      dataSection && dataSection !== "Unknown" ? dataSection : nodeSection;
    return section && sectionAliases.has(section);
  });

  // Secondary: match by node ID prefix (p1-, p2-, etc.)
  if (pageNodes.length === 0) {
    const idPrefix = `p${pageIndex + 1}-`;
    pageNodes = nodes.filter((n) => n.id.startsWith(idPrefix));
  }

  // Tertiary: trace all descendants of the start node with siblingIndex === pageIndex.
  // Handles UUID-format workflows where section/prefix matching finds nothing.
  if (pageNodes.length === 0) {
    const startNode = nodes.find(
      (n) =>
        n.type === "start" &&
        (n as unknown as { siblingIndex?: number }).siblingIndex === pageIndex,
    );
    if (startNode) {
      const descendantIds = new Set<string>();
      const queue = [startNode.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (descendantIds.has(id)) continue;
        descendantIds.add(id);
        for (const n of nodes) {
          if (n.parentNode === id && !descendantIds.has(n.id)) {
            queue.push(n.id);
          }
        }
      }
      pageNodes = nodes.filter((n) => descendantIds.has(n.id));
    }
  }

  if (pageNodes.length === 0) return { flow: "", pageNodeIds: new Set(), requiredComponents: [] };

  // Skip pure start/end nodes — they carry no meaningful data shape
  const meaningfulNodes = pageNodes.filter(
    (n) => n.type !== "start" && n.type !== "end",
  );

  // pageNodeIds contains only meaningful nodes (non-start/end).
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
    if (outputData && typeof outputData === "object") {
      lines.push(`  → outputData: ${compactShape(outputData)}`);
    }
    if (node.type === "task" && functionCode && typeof functionCode === "string") {
      const summary = functionCode.replace(/\s+/g, " ").trim().slice(0, 100);
      lines.push(`  → logic: ${summary}${functionCode.length > 100 ? "..." : ""}`);
    }
  }

  // Build parent-child hierarchy lines to help the AI understand node relationships
  const nodeMap = new Map(meaningfulNodes.map((n) => [n.id, n]));
  const hierarchyLines: string[] = [];
  // Find top-level nodes (no parent or parent is outside meaningful set)
  const topLevelNodes = meaningfulNodes.filter(
    (n) => !n.parentNode || !nodeMap.has(n.parentNode),
  );
  function printHierarchy(nodeId: string, depth: number): void {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "●" : "└─";
    hierarchyLines.push(
      `${indent}${prefix} [${node.type}] ${node.data.title ?? nodeId} (${nodeId})`,
    );
    const children = meaningfulNodes.filter((n) => n.parentNode === nodeId);
    for (const child of children) printHierarchy(child.id, depth + 1);
  }
  for (const n of topLevelNodes) printHierarchy(n.id, 0);

  // Pre-compute component groupings: group nodes + their children become one combined component.
  // Parent orchestrator nodes are absorbed into their first child group.
  // This reduces N nodes to ~5 components the AI can realistically implement.
  const requiredComponents = computePreGroupedComponents(meaningfulNodes);
  const requiredJson = JSON.stringify(requiredComponents, null, 2);

  const flow =
    lines.join("\n") +
    (hierarchyLines.length > 0
      ? `\n\nNode Hierarchy (shows data/state flow — use this to understand which nodes work together):\n${hierarchyLines.join("\n")}`
      : "") +
    `\n\n📋 AVAILABLE node IDs for @dg-components (use these nodeIds when building the metadata block):\n` +
    `RULE: Only create a named component for nodes that produce DIRECTLY VISIBLE, SELECTABLE UI.\n` +
    `If a node is a page-level orchestrator/container (manages state + composes other components), put its logic in App() instead — it will appear as "Not Implemented" in Coverage, which is correct.\n` +
    `Suggested grouping (parent orchestrator absorbed into first child group):\n${requiredJson}`;

  return { flow, pageNodeIds, requiredComponents };
}

/**
 * Pre-compute component groupings from meaningful workflow nodes.
 *
 * Pass 1: Group nodes + all their direct children → one combined component.
 * Pass 2: Remaining nodes that are PARENTS of already-grouped nodes are absorbed
 *         into the first matching group component (they provide data/state for it).
 * Pass 3: Truly isolated nodes (no group relationship) get their own standalone component.
 *
 * This reduces a 17-node page to ~5 manageable UI components while preserving
 * semantic relationships (e.g., a root "Court Discovery" node that owns court data
 * is absorbed into "Discover Nearby Courts" rather than becoming a stub component).
 */
function computePreGroupedComponents(
  nodes: WorkflowNode[],
): Array<{ componentKey: string; componentName: string; nodeIds: string[] }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Find direct children for each node (only within this page's node set)
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
    const base =
      title
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .split(" ")
        .filter(Boolean)
        .map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1)))
        .join("") || "component";
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${base}${suffix++}`;
    usedKeys.add(key);
    return key;
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

  // Pass 2: remaining nodes that are parents of already-assigned nodes → absorb into
  // the first group component whose members are direct children of this node.
  // These are page-level orchestrators that provide data/state to a group component.
  for (const node of nodes) {
    if (assignedIds.has(node.id)) continue;
    const myChildren = childrenOf.get(node.id) ?? [];
    const targetGroup = result.find((comp) =>
      comp.nodeIds.some((id) => myChildren.includes(id)),
    );
    if (targetGroup) {
      // Prepend so the parent node appears first in the nodeIds list
      targetGroup.nodeIds.unshift(node.id);
      assignedIds.add(node.id);
    }
  }

  // Pass 3: truly isolated nodes (no group relationship) get their own standalone component
  for (const node of nodes) {
    if (!assignedIds.has(node.id)) {
      assignedIds.add(node.id);
      const title = node.data.title ?? node.id;
      result.push({ componentKey: toKey(title), componentName: title, nodeIds: [node.id] });
    }
  }

  return result;
}

/**
 * Build the prompt context for one page.
 * When workflow nodes are available, extracts a structured nodeFlow
 * (type, PRD requirement, outputData shape, logic summary per node)
 * for the page. Falls back to flat dataFields/endpoints when no nodes match.
 */
function buildPageContext(
  page: AnalyzePRDResult["pages"][number],
  pageIndex: number,
  goal: string,
  nodes: WorkflowNode[],
): { ctx: UIPageContext; pageNodeIds: Set<string>; requiredComponents: Array<{ componentKey: string; componentName: string; nodeIds: string[] }> } {
  const { flow: nodeFlow, pageNodeIds, requiredComponents } = buildNodeFlow(page, pageIndex, nodes);

  // Fallback fields (used only when nodeFlow is empty)
  const dataFieldsSet = new Set<string>();
  const endpoints: UIPageContext["endpoints"] = [];

  if (!nodeFlow) {
    for (const node of nodes) {
      const nodeData = node.data.execution?.config?.nodeData;
      if (nodeData?.inputData && typeof nodeData.inputData === "object") {
        Object.keys(nodeData.inputData as object).forEach((k) =>
          dataFieldsSet.add(k),
        );
      }
      if (nodeData?.outputData && typeof nodeData.outputData === "object") {
        Object.keys(nodeData.outputData as object).forEach((k) =>
          dataFieldsSet.add(k),
        );
      }
      if (node.type === "service") {
        const http = (node.data as ServiceNodeData).http;
        const endpoint = http?.endpoint;
        if (endpoint && !endpoints.some((e) => e.endpoint === endpoint)) {
          endpoints.push({ method: http?.method ?? "POST", endpoint });
        }
      }
    }
  }

  const ctx: UIPageContext = {
    pageName: page.name,
    pagePath: page.path,
    goal,
    features: page.features,
    nodeFlow: nodeFlow || undefined,
    dataFields: [...dataFieldsSet].slice(0, 20),
    endpoints: endpoints.slice(0, 10),
  };

  return { ctx, pageNodeIds, requiredComponents };
}

// ─── UI Code Validator ───────────────────────────────────────────────────────

/**
 * Validate generated UI code against all completion conditions.
 * Returns an array of human-readable violation strings (empty = fully valid).
 */
function validateUICode(
  code: string,
  components: UIComponent[],
  pageNodeIds: Set<string>,
): string[] {
  const violations: string[] = [];

  // 0. @dg-components block must exist when workflow nodes are available
  if (pageNodeIds.size > 0 && components.length === 0) {
    violations.push(
      `MISSING @dg-components: No valid @dg-components metadata block was found. ` +
        `After function App() {...}, you MUST append a comment block that starts with /* @dg-components ` +
        `and ends with */ (the closing */ is REQUIRED — do not omit it). ` +
        `Example:\n/* @dg-components\n[{"componentKey":"myComp","componentName":"My Comp","nodeIds":["node-id-here"]}]\n*/`,
    );
  }

  // 1. No phantom components (nodeIds: []) when workflow nodes are available
  if (pageNodeIds.size > 0) {
    const phantoms = components.filter((c) => c.nodeIds.length === 0);
    if (phantoms.length > 0) {
      violations.push(
        `PHANTOM COMPONENTS: These components have no nodeIds: [${phantoms.map((c) => c.componentKey).join(", ")}]. ` +
          `Remove them or assign valid nodeIds from the workflow.`,
      );
    }
  }

  // 2. No nodeId shared between two components
  const nodeIdOwners = new Map<string, string[]>();
  for (const comp of components) {
    for (const id of comp.nodeIds) {
      if (!nodeIdOwners.has(id)) nodeIdOwners.set(id, []);
      nodeIdOwners.get(id)!.push(comp.componentKey);
    }
  }
  for (const [id, owners] of nodeIdOwners) {
    if (owners.length > 1) {
      violations.push(
        `DUPLICATE NODE MAPPING: nodeId "${id}" is referenced by multiple components: [${owners.join(", ")}]. ` +
          `Each nodeId must appear in exactly ONE component.`,
      );
    }
  }

  // 3. data-dg-component must NOT appear inside function App()
  // Heuristic: find App function body by matching from "function App(" to the balancing brace
  const appStart = code.indexOf("function App(");
  if (appStart !== -1) {
    let depth = 0;
    let inApp = false;
    let appBody = "";
    for (let i = appStart; i < code.length; i++) {
      if (code[i] === "{") {
        depth++;
        inApp = true;
      } else if (code[i] === "}") {
        depth--;
        if (inApp && depth === 0) {
          appBody = code.slice(appStart, i + 1);
          break;
        }
      }
    }
    if (appBody) {
      const dgInApp = appBody.match(/data-dg-component=["'][^"']+["']/g);
      if (dgInApp) {
        violations.push(
          `DATA-DG-COMPONENT INSIDE APP: Found data-dg-component attributes inside function App(): ` +
            `[${dgInApp.join(", ")}]. These MUST be on the root elements of named component functions only — remove ALL of them from App().`,
        );
      }
    }
  }

  // 4. Each non-phantom component must have a named function + data-dg-component
  for (const comp of components) {
    if (comp.nodeIds.length === 0) continue;
    const key = comp.componentKey;
    const pascal = key.charAt(0).toUpperCase() + key.slice(1);

    const hasFn =
      code.includes(`function ${pascal}(`) ||
      code.includes(`function ${pascal} (`);
    if (!hasFn) {
      violations.push(
        `MISSING COMPONENT FUNCTION: No "function ${pascal}(...)" found for componentKey "${key}". ` +
          `Create this named React component function BEFORE function App().`,
      );
    }

    const hasDgAttr = new RegExp(`data-dg-component=["']${key}["']`).test(code);
    if (!hasDgAttr) {
      violations.push(
        `MISSING DATA-DG-COMPONENT: No data-dg-component="${key}" found. ` +
          `Add it to the ROOT element of function ${pascal}().`,
      );
    }
  }

  // 5. Named components must NOT render other named data-dg-component components
  // (that would make them page wrappers instead of focused UI sections)
  for (const comp of components) {
    if (comp.nodeIds.length === 0) continue;
    const key = comp.componentKey;
    const pascal = key.charAt(0).toUpperCase() + key.slice(1);

    const fnStart = code.indexOf(`function ${pascal}(`);
    if (fnStart === -1) continue;

    // Extract function body by counting braces
    let depth = 0;
    let inFn = false;
    let fnBody = "";
    for (let i = fnStart; i < code.length; i++) {
      if (code[i] === "{") { depth++; inFn = true; }
      else if (code[i] === "}") {
        depth--;
        if (inFn && depth === 0) { fnBody = code.slice(fnStart, i + 1); break; }
      }
    }

    const childComponents = components
      .filter((other) => other.componentKey !== key)
      .map((other) => other.componentKey.charAt(0).toUpperCase() + other.componentKey.slice(1))
      .filter((otherPascal) => fnBody.includes(`<${otherPascal}`));

    if (childComponents.length > 0) {
      violations.push(
        `PAGE WRAPPER COMPONENT: function ${pascal}() renders other named components [${childComponents.join(", ")}]. ` +
          `Named components MUST render their OWN UI directly — ONLY function App() may compose multiple named components. ` +
          `FIX: Delete function ${pascal}(), remove "${key}" from @dg-components entirely (its nodeIds become Not Implemented — that is correct for orchestration nodes), ` +
          `and move its state/logic directly into App() which renders each child component.`,
      );
    }
  }

  // 6. No invisible root elements on data-dg-component elements
  // Detects: <... data-dg-component="x" className="hidden ..." or className="... hidden ..."
  // and style={{display:'none'}} / display:"none" patterns
  const invisibleClassRe =
    /data-dg-component=["'][^"']+["'][^>]*className=["'][^"']*\bhidden\b[^"']*["']|className=["'][^"']*\bhidden\b[^"']*["'][^>]*data-dg-component/;
  const invisibleStyleRe =
    /data-dg-component=["'][^"']+["'][^>]*style=\{\{[^}]*display\s*:\s*['"]none['"]/;
  if (invisibleClassRe.test(code) || invisibleStyleRe.test(code)) {
    violations.push(
      `INVISIBLE COMPONENT: A component with data-dg-component has className="hidden" or display:none on its root element. ` +
        `FORBIDDEN. Every component MUST render visible UI. ` +
        `If the node represents initialization/loading logic, implement it as a visible loading skeleton, header, or status bar.`,
    );
  }

  return violations;
}

/**
 * Parse raw OpenAI output → { code, components }.
 * Strips markdown fences and extracts @dg-components metadata.
 */
function parseUIOutput(
  raw: string,
  pageNodeIds: Set<string>,
): { code: string; components: UIComponent[] } {
  const stripped = raw
    .replace(/^```(?:jsx?|tsx?|javascript)?\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  // Match closed comment first; fall back to unterminated (AI forgot closing */).
  // Even when */ is missing, the JSON array inside is usually complete and parseable.
  const metaMatch =
    stripped.match(/\/\*\s*@dg-components\s*([\s\S]*?)\*\//) ||
    stripped.match(/\/\*\s*@dg-components\s*([\s\S]*)$/);

  let components: UIComponent[] = [];

  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1].trim()) as UIComponent[];
      // Keep AI-generated nodeIds as-is; validation will flag invalid ones.
      // Only filter when pageNodeIds is populated (known-page workflows).
      components = parsed.map((comp) => ({
        ...comp,
        nodeIds:
          pageNodeIds.size > 0
            ? comp.nodeIds.filter((id) => pageNodeIds.has(id))
            : comp.nodeIds,
      }));
    } catch {
      // malformed JSON — leave components empty
    }
  }

  // Always strip the @dg-components block from runtime code.
  // Handles both properly-closed (/* ... */) and unterminated (AI forgot closing */) cases.
  // Unterminated comments cause Babel to throw "Unterminated comment" inside the srcdoc.
  const code = stripped
    .replace(/\/\*\s*@dg-components[\s\S]*?\*\//g, "") // closed comment
    .replace(/\/\*\s*@dg-components[\s\S]*$/, "")       // unterminated — strip to end of string
    .trim();

  return { code, components };
}

/**
 * Build a targeted correction prompt listing all violations.
 * Sends the previous code + exact required @dg-components back for repair.
 */
function buildCorrectionPrompt(
  violations: string[],
  previousCode: string,
  nodeFlow: string,
  requiredComponents: Array<{ componentKey: string; componentName: string; nodeIds: string[] }>,
): string {
  const requiredJson = JSON.stringify(requiredComponents, null, 2);
  return `Your React code has ${violations.length} violation(s) that MUST ALL be fixed:

${violations.map((v, i) => `${i + 1}. ${v}`).join("\n\n")}

━━━ REQUIRED @dg-components — USE THIS EXACTLY ━━━
Every component key below MUST have:
  1. A named function component (e.g. componentKey "courtMap" → function CourtMap(...))
  2. data-dg-component="componentKey" on the ROOT element of that function
  3. The function defined BEFORE function App()

${requiredJson}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Previous code (fix this — keep working parts, fix violations):
\`\`\`
${previousCode}
\`\`\`

Workflow nodes reference:
${nodeFlow}

Output the COMPLETE corrected JavaScript code: all component functions → function App() → @dg-components metadata block.
⚠️ The @dg-components block MUST end with */ — never omit the closing delimiter.`;
}

/**
 * Call OpenAI once for the given page context and return the generated code
 * along with extracted component traceability metadata.
 * Includes a validation+retry loop (up to MAX_UI_RETRIES) to enforce all rules.
 */
const MAX_UI_RETRIES = 3;

async function generatePageCode(
  openai: OpenAI,
  ctx: UIPageContext,
  pageNodeIds: Set<string>,
  requiredComponents: Array<{ componentKey: string; componentName: string; nodeIds: string[] }>,
): Promise<{ code: string; components: UIComponent[] }> {
  // ── Initial generation ────────────────────────────────────────────────────
  const firstResponse = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    instructions: UI_GENERATION_SYSTEM_PROMPT,
    input: getUIGenerationContent(ctx),
  });

  let { code, components } = parseUIOutput(
    firstResponse.output_text ?? "",
    pageNodeIds,
  );

  const nodeFlow = ctx.nodeFlow ?? "";

  // ── Validation + correction loop ─────────────────────────────────────────
  for (let attempt = 0; attempt < MAX_UI_RETRIES; attempt++) {
    const violations = validateUICode(code, components, pageNodeIds);
    if (violations.length === 0) break; // All conditions met

    console.warn(
      `[generatePageCode] "${ctx.pageName}" attempt ${attempt + 1}/${MAX_UI_RETRIES} — ` +
        `${violations.length} violation(s):\n` +
        violations.map((v) => `  · ${v}`).join("\n"),
    );

    if (attempt === MAX_UI_RETRIES - 1) {
      console.error(
        `[generatePageCode] "${ctx.pageName}" still has violations after ${MAX_UI_RETRIES} retries.`,
      );
      break;
    }

    // Send correction prompt with the previous code + required components
    const correctionResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      instructions: UI_GENERATION_SYSTEM_PROMPT,
      input: buildCorrectionPrompt(violations, code, nodeFlow, requiredComponents),
    });

    const corrected = parseUIOutput(
      correctionResponse.output_text ?? "",
      pageNodeIds,
    );
    code = corrected.code;
    components = corrected.components;
  }

  return { code, components };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a self-contained React component for each page in the workflow.
 *
 * - If sampleId is provided: returns pre-built fixture data (no API call).
 * - Otherwise: calls OpenAI sequentially per page using the analysis result
 *   and workflow node data as context.
 */
export const generateUIAction = async ({
  analysisResult,
  nodes,
  sampleId,
}: GenerateUIActionParams): Promise<GenerateUIResponse> => {
  // Sample bypass — return pre-built fixture without calling OpenAI
  if (sampleId) {
    const pages = getUIPreviewBySampleId(sampleId);
    if (pages) return { pages };
  }

  const openai = getOpenAIClient();
  const pages: GeneratedUIPage[] = [];

  for (const [i, page] of analysisResult.pages.entries()) {
    const { ctx, pageNodeIds, requiredComponents } = buildPageContext(page, i, analysisResult.goal, nodes);
    try {
      const { code, components } = await generatePageCode(openai, ctx, pageNodeIds, requiredComponents);
      pages.push({
        pageId: page.id,
        pageName: page.name,
        pagePath: page.path,
        code,
        components,
        status: "done",
      });
    } catch (err) {
      pages.push({
        pageId: page.id,
        pageName: page.name,
        pagePath: page.path,
        code: `function App() { return <div style={{padding:32,fontFamily:'system-ui',color:'#ef4444'}}><h2>${page.name}</h2><p>${err instanceof Error ? err.message : "Generation failed"}</p></div>; }`,
        components: [],
        status: "error",
        error: err instanceof Error ? err.message : "Generation failed",
      });
    }
  }

  return { pages };
};

// ─────────────────────────────────────────────────────────────────────────────

const UI_REFINEMENT_SYSTEM_PROMPT = `You are a senior mobile UI/UX developer refining an existing self-contained React component (function App() { ... }).
When the user makes a request, first identify the UX intent behind it, then apply the best mobile UX pattern — not the most literal interpretation.
Preserve all unrelated code and the overall visual style.

## UX Intent Interpretation (always apply the right pattern, not the literal wording)
- "닫기/close/dismiss 버튼" → icon-only button, top-right of the modal/panel, w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center, using an × character or X icon
- "삭제/delete 버튼" → icon-only trash button (🗑 or ×), text-red-500, never a large labeled button unless in a form
- "뒤로가기/back" → top-left ← icon button, not a text link
- "추가/add/등록" → FAB or primary CTA button, not a plain text link
- "로딩/loading 상태" → replace button text with a spinner (animate-spin rounded-full border-2 border-white border-t-transparent), disable the button
- "탭 추가/tab" → pill-style tab in the existing tab container, matching active/inactive styles already present
- "비어있음/empty state" → centered illustration area with icon + title + subtitle, not just text
- "토스트/알림/피드백" → fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full pill, auto-dismiss via setTimeout
- "모달/팝업 열기" → use showModal state toggle + fixed inset-0 backdrop (bg-black/40) + centered or bottom-sheet panel
- "필터/정렬" → horizontal scrollable chip row, not a dropdown unless explicitly requested

## Code Rules (same as original)
- Single function named App: function App() { ... }
- NO import statements. React is available as global.
- Use React.useState, React.useEffect (always prefix hooks with React.)
- Tailwind CSS classes ONLY — no style={{}} except for unavoidable dynamic values (e.g. style={{ width: \`\${pct}%\` }})
- NEVER use alert(), confirm(), or prompt() — use React state for toast/snackbar feedback instead
- Output ONLY the complete updated JavaScript code — no markdown fences, no explanation

## Layout Safety Rules (CRITICAL)
- NEVER add forms or input fields as fixed/absolute positioned elements — they will overlap content
- When adding a form triggered by a FAB or button: use a showForm state toggle + render the form as an INLINE card (bg-white rounded-2xl shadow-sm p-4) inside the normal scroll flow, at the bottom of the list
- FAB pattern: onClick={() => setShowForm(p => !p)}, icon shows "+" when closed and "×" when open
- Only use position: fixed for: FABs, toasts/snackbars, and overlay backdrops — nothing else

## Style Consistency Rules
- New elements MUST match the existing visual style (card design, typography, color accent)
- Card: bg-white rounded-2xl shadow-sm p-4 mb-3
- Inputs inside forms: bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-{accent}-400
- Buttons inside forms: rounded-xl py-2.5 text-sm font-semibold (primary: bg-{accent}-500 text-white, cancel: border border-slate-200 text-slate-500)
- Do NOT introduce new color schemes or layout patterns not already present in the component

## Feature Grounding Rule
- Every button, FAB, form, or interactive element you add MUST implement a real feature
- FORBIDDEN: decorative elements, placeholder buttons with no onClick, non-functional toggles
- Every onClick handler must call a real state update or user action`;


export interface RefineChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RefineUIPageActionParams {
  /** Current component code to refine */
  currentCode: string;
  /** Full conversation history (user asks → assistant replies → user asks again …) */
  messages: RefineChatMessage[];
  pageName: string;
}

/**
 * Refines an existing generated UI page via a multi-turn chat conversation.
 * The caller maintains the message history and appends each new user message
 * before calling this action. Returns the full updated component code.
 */
export const refineUIPageAction = async ({
  currentCode,
  messages,
  pageName,
}: RefineUIPageActionParams): Promise<{ code: string }> => {
  const openai = getOpenAIClient();

  // Build multi-turn input: start with the current code as context,
  // then replay the conversation so the model has full history.
  const conversationInput = [
    {
      role: "user" as const,
      content: `Here is the current code for the "${pageName}" page:\n\`\`\`\n${currentCode}\n\`\`\``,
    },
    {
      role: "assistant" as const,
      content: "Understood. I have the current code. What would you like to change?",
    },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    instructions: UI_REFINEMENT_SYSTEM_PROMPT,
    input: conversationInput,
  });

  const raw = response.output_text ?? "";
  const code = raw
    .replace(/^```(?:jsx?|tsx?|javascript)?\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  return { code };
};
