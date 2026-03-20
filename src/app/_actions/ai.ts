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
  GenerateWorkflowActionParams,
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
import { deterministicRepairGroupBoundaries, deterministicRepairPipelineStrategyA } from "@/contexts/WorkflowGenerator/validators/groupNodePipeline";

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
  nodeLibrary,
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
  nodeLibrary: GenerateWorkflowActionParams["nodeLibrary"],
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
