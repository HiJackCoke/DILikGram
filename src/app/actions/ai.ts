"use server";

/**
 * Server Actions for AI-powered workflow operations
 *
 * Security: API calls are made server-side with environment variable API key
 * All functions use Next.js Server Actions pattern
 */

import OpenAI from "openai";
import { v4 as uuid } from "uuid";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
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
  DecisionNodeData,
} from "@/types/nodes";
import type { TestCase } from "@/types/prd";
import type {
  PRDAnalysisResult,
  AnalyzePRDAction,
} from "@/types/ai/prdAnalysis";
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
  ANALYSIS_SYSTEM_PROMPT,
  getAnalysisContent,
} from "@/fixtures/prompts/analysis";
import {
  buildAnalysisContext,
  buildSinglePageContext,
} from "@/utils/prd/contextBuilder";

// ============================================================================
// OPENAI CLIENT INITIALIZATION
// ============================================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
        "Please add it to your .env.local file.",
    );
  }

  return new OpenAI({ apiKey });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Convert OpenAI SDK errors to user-friendly messages
 */
function handleOpenAIError(error: unknown): never {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) {
      throw new Error(
        "Invalid OpenAI API key. Please check your environment configuration.",
      );
    }
    if (error.status === 429) {
      throw new Error(
        "OpenAI rate limit exceeded. Please try again in a moment.",
      );
    }
    if (error.status === 500 || error.status === 503) {
      throw new Error(
        "OpenAI service temporarily unavailable. Please try again later.",
      );
    }

    throw new Error(`OpenAI API error: ${error.message}`);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(
    "An unexpected error occurred while processing your request.",
  );
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Analyze PRD and extract page/feature structure (Step 1 of 2-step pipeline)
 *
 * @param prdContent - Base64 PDF data URL or plain text PRD
 * @param prompt - User's additional context/instructions
 * @returns Structured PRD analysis with pages and features
 */
export const analyzePRDAction: AnalyzePRDAction = async (
  prdContent,
  prompt,
) => {
  if (!prdContent || !prdContent.trim()) {
    throw new Error("PRD content is required for analysis");
  }

  try {
    const openai = getOpenAIClient();

    let prdText: string;
    if (prdContent.startsWith("data:application/pdf;base64,")) {
      const base64Data = prdContent.replace(
        /^data:application\/pdf;base64,/,
        "",
      );
      const pdfBuffer = Buffer.from(base64Data, "base64");
      const pdfData = await pdfParse(pdfBuffer);
      prdText = pdfData.text;
    } else {
      prdText = prdContent;
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      instructions: ANALYSIS_SYSTEM_PROMPT,
      input: getAnalysisContent(prdText, prompt),
      text: {
        format: { type: "json_object" },
      },
    });

    const content = response.output_text;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content) as PRDAnalysisResult;

    if (!result.goal || !Array.isArray(result.pages)) {
      throw new Error("Invalid analysis response structure from OpenAI");
    }

    return result;
  } catch (error) {
    handleOpenAIError(error);
  }
};

/**
 * Generate workflow from prompt using GPT-4o-mini
 *
 * @param prompt - User's workflow description
 * @param prdContent - Optional PRD content: base64 PDF data URL or plain text
 * @param nodeLibrary - Optional array of reusable node templates
 * @returns Generated workflow with nodes and metadata
 */
export const generateWorkflowAction: GenerateWorkflowAction = async (
  prompt,
  prdContent,
  nodeLibrary,
  analysisResult?: PRDAnalysisResult,
) => {
  if (!prompt || !prompt.trim()) {
    throw new Error("Workflow description is required");
  }

  try {
    const openai = getOpenAIClient();

    let prdText: string | undefined;
    if (prdContent) {
      if (prdContent.startsWith("data:application/pdf;base64,")) {
        const base64Data = prdContent.replace(
          /^data:application\/pdf;base64,/,
          "",
        );
        const pdfBuffer = Buffer.from(base64Data, "base64");
        const pdfData = await pdfParse(pdfBuffer);
        prdText = pdfData.text;
      } else {
        prdText = prdContent;
      }
    }

    const contexts = buildGenerationContexts(prdText, analysisResult);
    const allNodes: WorkflowNode[] = [];

    for (let i = 0; i < contexts.length; i++) {
      if (contexts.length > 1) {
        console.log(
          `[generateWorkflowAction] Generating page ${i + 1}/${contexts.length}: ${analysisResult!.pages[i].name}`,
        );
      }
      const nodes = await generatePageNodes(
        openai,
        prompt,
        contexts[i],
        nodeLibrary,
      );
      allNodes.push(...nodes);
    }

    assertNodesValid(allNodes);

    let nodes = populateGroupChildren(allNodes);
    assertNoCircularGroupReferences(nodes);
    nodes = removeUndersizedGroups(nodes);
    nodes = normalizeNodeDefaults(nodes);
    if (prdContent) nodes = applyPRDFallbacks(nodes, prdContent);
    nodes = normalizeStartInputData(nodes);

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

/** Throw if any GroupNode.parentNode is also listed in its own groups[] (prevents infinite loop). */
function assertNoCircularGroupReferences(nodes: WorkflowNode[]): void {
  nodes.forEach((node) => {
    if (node.type === "group" && node.parentNode) {
      const groupData = node.data as GroupNodeData;
      const internalNodeIds = new Set(
        (groupData.groups || []).map((n: WorkflowNode) => n.id),
      );
      if (internalNodeIds.has(node.parentNode)) {
        throw new Error(
          `CIRCULAR REFERENCE DETECTED: GroupNode "${node.data.title}" (id: ${node.id}) ` +
            `has parentNode "${node.parentNode}" which is also in its groups[] array. ` +
            `This will cause infinite loop. ` +
            `Fix: Make "${node.parentNode}" a standalone node OUTSIDE the GroupNode.`,
        );
      }
    }
  });
}

/** Remove GroupNodes with < 2 non-Decision children and re-parent their orphaned children. */
function removeUndersizedGroups(nodes: WorkflowNode[]): WorkflowNode[] {
  const groupChildren: Record<string, WorkflowNode[]> = {};
  nodes.forEach((node) => {
    if (node.parentNode) {
      if (!groupChildren[node.parentNode]) groupChildren[node.parentNode] = [];
      groupChildren[node.parentNode].push(node);
    }
  });

  const invalidGroupIds = new Set(
    nodes
      .filter((n) => {
        if (n.type !== "group") return false;
        const validChildren = (groupChildren[n.id] ?? []).filter(
          (c) => c.type !== "decision",
        );
        return validChildren.length < 2;
      })
      .map((n) => n.id),
  );

  if (invalidGroupIds.size === 0) return nodes;

  const groupParentMap: Record<string, string | undefined> = {};
  nodes
    .filter((n) => invalidGroupIds.has(n.id))
    .forEach((n) => {
      groupParentMap[n.id] = n.parentNode;
    });

  const resolveParent = (id: string | undefined): string | undefined => {
    if (!id || !invalidGroupIds.has(id)) return id;
    return resolveParent(groupParentMap[id]);
  };

  return nodes
    .filter((n) => !invalidGroupIds.has(n.id))
    .map((n) => {
      if (n.parentNode && invalidGroupIds.has(n.parentNode)) {
        return { ...n, parentNode: resolveParent(n.parentNode) };
      }
      return n;
    });
}

/** Apply type-specific defaults: ServiceNode http/retry/timeout, DecisionNode condition, GroupNode functionCode. */
function normalizeNodeDefaults(nodes: WorkflowNode[]): WorkflowNode[] {
  const VALID_CONDITION_OPERATORS = new Set([
    "has",
    "hasNot",
    "truthy",
    "falsy",
  ]);

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
                simulation: {
                  enabled: true,
                  ...node.data.execution.config.simulation,
                },
              },
            },
          },
        };
      }

      return { ...node, data: baseData };
    }

    if (node.type === "decision") {
      const decisionData = node.data as DecisionNodeData;
      if (decisionData.condition) {
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(decisionData.condition)) {
          if (VALID_CONDITION_OPERATORS.has(key)) {
            sanitized[key] = value as string;
          }
        }
        return {
          ...node,
          data: { mode: "panel", ...node.data, condition: sanitized },
        };
      }
    }

    if (node.type === "group") {
      const hasExecutionConfig = node.data.execution?.config;
      const hasFunctionCode = hasExecutionConfig?.functionCode;

      if (!hasFunctionCode) {
        console.warn(
          `GroupNode ${node.id} missing functionCode. Injecting default: "return inputData;"`,
        );

        const groupData = node.data as GroupNodeData;
        const groups = groupData.groups || [];
        const lastNode = groups[groups.length - 1];
        const lastNodeOutputData =
          lastNode?.data?.execution?.config?.nodeData?.outputData;

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
                nodeData: {
                  inputData: node.data.execution?.config?.nodeData?.inputData,
                  outputData: lastNodeOutputData || {},
                },
                lastModified: Date.now(),
              },
            },
          },
        };
      }
    }

    return node;
  });
}

/** Add placeholder prdReference and default testCases when PRD content was provided. */
function applyPRDFallbacks(
  nodes: WorkflowNode[],
  prdContent: string,
): WorkflowNode[] {
  void prdContent; // prdContent presence was already checked by the caller
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

/** Force inputData to null for root nodes and direct children of start nodes. */
function normalizeStartInputData(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    const isRootNode = !node.parentNode;
    const parentNode = nodes.find((n) => n.id === node.parentNode);
    const isStartNodeChild = parentNode?.type === "start";

    if (!isRootNode && !isStartNodeChild) return node;

    const execution = node.data.execution;
    const config = execution?.config;
    const nodeData = config?.nodeData;

    if (!nodeData) return node;

    return {
      ...node,
      data: {
        ...node.data,
        execution: {
          ...execution,
          config: {
            ...config,
            nodeData: { ...nodeData, inputData: null },
          },
        },
      },
    };
  });
}

// ============================================================================
// PRIVATE HELPERS (generateWorkflowAction — generation)
// ============================================================================

/**
 * Build the list of enriched PRD text strings to generate against.
 * - No analysisResult → [prdText] (single call, no context)
 * - Single page       → [prdText + full analysis context] (single call)
 * - Multiple pages    → one entry per page with per-page context (N calls)
 */
function buildGenerationContexts(
  prdText: string | undefined,
  analysisResult: PRDAnalysisResult | undefined,
): Array<string | undefined> {
  if (!analysisResult) return [prdText];

  if (analysisResult.pages.length > 1) {
    return analysisResult.pages.map(
      (_, i) =>
        `${prdText ?? ""}\n\n${buildSinglePageContext(analysisResult, i)}`,
    );
  }

  return [`${prdText ?? ""}\n\n${buildAnalysisContext(analysisResult)}`];
}

/**
 * Call OpenAI once for the given context and return the parsed nodes array.
 */
async function generatePageNodes(
  openai: OpenAI,
  prompt: string,
  enrichedPrdText: string | undefined,
  nodeLibrary: Parameters<GenerateWorkflowAction>[2],
): Promise<WorkflowNode[]> {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    instructions: GENERATION_SYSTEM_PROMPT,
    input: getGenerationContent(prompt, enrichedPrdText, nodeLibrary),
    text: { format: { type: "json_object" } },
  });

  const content = response.output_text;
  if (!content) throw new Error("No response from OpenAI");

  const workflow = JSON.parse(content) as GenerateWorkflowResponse;
  return workflow.nodes ?? [];
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
 * @param nodeId - Target node ID to edit
 * @param prompt - User's edit instructions
 * @param nodes - Current workflow nodes
 * @returns Incremental edit operations (update/create/delete)
 */
export const updateWorkflowAction: UpdateWorkflowAction = async (
  nodeId,
  prompt,
  nodes,
) => {
  if (!prompt || !prompt.trim()) {
    throw new Error("Edit description is required");
  }

  if (!nodeId) {
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
          content: getModificationContent({ prompt, nodeId, nodes }),
        },
      ],
      temperature: 0.6,
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
