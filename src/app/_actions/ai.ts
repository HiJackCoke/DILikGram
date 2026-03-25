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
): string {
  const sectionAliases = new Set([
    page.name,
    page.name.toLowerCase(),
    `p${pageIndex + 1}`,
  ]);

  const pageNodes = nodes.filter((n) => {
    const section = n.data.prdReference?.section;
    return section && sectionAliases.has(section);
  });

  if (pageNodes.length === 0) return "";

  // Skip pure start/end nodes — they carry no meaningful data shape
  const meaningfulNodes = pageNodes.filter(
    (n) => n.type !== "start" && n.type !== "end",
  );

  const lines: string[] = [];

  for (const node of meaningfulNodes) {
    const nodeData = node.data.execution?.config?.nodeData;
    const outputData = nodeData?.outputData;
    const functionCode = node.data.execution?.config?.functionCode;
    const prdReq = node.data.prdReference?.requirement;

    // Header: [type] title
    lines.push(`[${node.type}] ${node.data.title}`);

    // PRD requirement (the "why" — what user need this implements)
    if (prdReq) {
      lines.push(`  PRD: "${prdReq}"`);
    }

    // Service node: show HTTP method + endpoint
    if (node.type === "service") {
      const http = (node.data as ServiceNodeData).http;
      if (http?.endpoint) {
        lines.push(`  → ${http.method ?? "POST"} ${http.endpoint}`);
      }
    }

    // outputData shape (most valuable for mock data)
    if (outputData && typeof outputData === "object") {
      lines.push(`  → outputData: ${compactShape(outputData)}`);
    }

    // functionCode summary for task nodes (first 100 chars, trimmed)
    if (
      node.type === "task" &&
      functionCode &&
      typeof functionCode === "string"
    ) {
      const summary = functionCode.replace(/\s+/g, " ").trim().slice(0, 100);
      lines.push(
        `  → logic: ${summary}${functionCode.length > 100 ? "..." : ""}`,
      );
    }
  }

  return lines.join("\n");
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
): UIPageContext {
  const nodeFlow = buildNodeFlow(page, pageIndex, nodes);

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

  return {
    pageName: page.name,
    pagePath: page.path,
    goal,
    features: page.features,
    nodeFlow: nodeFlow || undefined,
    dataFields: [...dataFieldsSet].slice(0, 20),
    endpoints: endpoints.slice(0, 10),
  };
}

/**
 * Call OpenAI once for the given page context and return the generated code.
 * Strips markdown fences in case the model includes them despite instructions.
 */
async function generatePageCode(
  openai: OpenAI,
  ctx: UIPageContext,
): Promise<string> {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    instructions: UI_GENERATION_SYSTEM_PROMPT,
    input: getUIGenerationContent(ctx),
  });

  const raw = response.output_text ?? "";
  // Strip markdown fences if the model included them
  return raw
    .replace(/^```(?:jsx?|tsx?|javascript)?\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
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
    const ctx = buildPageContext(page, i, analysisResult.goal, nodes);
    try {
      const code = await generatePageCode(openai, ctx);
      pages.push({
        pageId: page.id,
        pageName: page.name,
        pagePath: page.path,
        code,
        status: "done",
      });
    } catch (err) {
      pages.push({
        pageId: page.id,
        pageName: page.name,
        pagePath: page.path,
        code: `function App() { return <div style={{padding:32,fontFamily:'system-ui',color:'#ef4444'}}><h2>${page.name}</h2><p>${err instanceof Error ? err.message : "Generation failed"}</p></div>; }`,
        status: "error",
        error: err instanceof Error ? err.message : "Generation failed",
      });
    }
  }

  return { pages };
};

// ─────────────────────────────────────────────────────────────────────────────

const UI_REFINEMENT_SYSTEM_PROMPT = `You are editing an existing self-contained React component (function App() { ... }).
Apply ONLY the changes the user requests. Preserve all unrelated code.

Same rules as the original:
- Single function named App: function App() { ... }
- NO import statements. React is available as global.
- Use React.useState, React.useEffect (always prefix hooks with React.)
- Tailwind CSS classes ONLY — no style={{}} except for dynamic values
- NEVER use alert(), confirm(), or prompt()
- Output ONLY the complete updated JavaScript code — no markdown fences, no explanation`;

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
