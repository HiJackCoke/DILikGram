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
  DecisionNodeData,
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
 * Generate workflow from prompt using GPT-4o-mini
 *
 * @param prompt - User's workflow description
 * @param prdText - Optional PRD requirements text
 * @param nodeLibrary - Optional array of reusable node templates
 * @returns Generated workflow with nodes and metadata
 */
export const generateWorkflowAction: GenerateWorkflowAction = async (
  prompt,
  prdText,
  nodeLibrary,
) => {
  if (!prompt || !prompt.trim()) {
    throw new Error("Workflow description is required");
  }

  try {
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: GENERATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: getGenerationContent(prompt, prdText, nodeLibrary),
        },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const generatedWorkflow = JSON.parse(content) as GenerateWorkflowResponse;

    // Validation
    if (!generatedWorkflow.nodes || !Array.isArray(generatedWorkflow.nodes)) {
      throw new Error("Generated workflow missing nodes array");
    }

    // Build a map of groupId → child nodes (used for GroupNode post-processing)
    const groupChildren: Record<string, WorkflowNode[]> = {};
    generatedWorkflow.nodes.forEach((node) => {
      if (node.parentNode) {
        if (!groupChildren[node.parentNode])
          groupChildren[node.parentNode] = [];
        groupChildren[node.parentNode].push(node);
      }
    });

    // Populate GroupNode.data.groups from child nodes — Task/Service only (Decision excluded)
    // Decision nodes run at workflow level after GroupNode, not inside sequential pipeline
    generatedWorkflow.nodes = generatedWorkflow.nodes.map((node) => {
      if (node.type === "group") {
        return {
          ...node,
          data: {
            ...node.data,
            groups: (groupChildren[node.id] ?? []).filter(
              (child) => child.type !== "decision",
            ),
          },
        };
      }
      return node;
    });

    // ─────────────────────────────────────────────────────────
    // 🚨 CIRCULAR REFERENCE CHECK (CRITICAL - PREVENTS INFINITE LOOP)
    // ─────────────────────────────────────────────────────────
    generatedWorkflow.nodes.forEach((node) => {
      if (node.type === "group" && node.parentNode) {
        // Extract all internal node IDs from groups[]
        const groupData = node.data as GroupNodeData;
        const internalNodeIds = new Set(
          (groupData.groups || []).map((n: WorkflowNode) => n.id),
        );

        // Check if GroupNode.parentNode is in groups[]
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
    // ─────────────────────────────────────────────────────────

    // Remove GroupNodes with < 2 non-Decision children and re-parent their orphaned children
    const invalidGroupIds = new Set(
      generatedWorkflow.nodes
        .filter((n) => {
          if (n.type !== "group") return false;
          const validChildren = (groupChildren[n.id] ?? []).filter(
            (c) => c.type !== "decision",
          );
          return validChildren.length < 2;
        })
        .map((n) => n.id),
    );

    if (invalidGroupIds.size > 0) {
      const groupParentMap: Record<string, string | undefined> = {};
      generatedWorkflow.nodes
        .filter((n) => invalidGroupIds.has(n.id))
        .forEach((n) => {
          groupParentMap[n.id] = n.parentNode;
        });

      generatedWorkflow.nodes = generatedWorkflow.nodes
        .filter((n) => !invalidGroupIds.has(n.id))
        .map((n) => {
          if (n.parentNode && invalidGroupIds.has(n.parentNode)) {
            return { ...n, parentNode: groupParentMap[n.parentNode] };
          }
          return n;
        });
    }

    // Apply node type-specific normalization (always, regardless of PRD)
    const VALID_CONDITION_OPERATORS = new Set([
      "has",
      "hasNot",
      "truthy",
      "falsy",
    ]);
    generatedWorkflow.nodes = generatedWorkflow.nodes.map((node) => {
      // ServiceNode: ensure required fields have defaults
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

        // Enable simulation by default for AI-generated Service nodes (if execution exists)
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

        return {
          ...node,
          data: baseData,
        };
      }

      // DecisionNode: sanitize condition keys to valid operators only
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
            data: {
              mode: "panel",
              ...node.data,
              condition: sanitized,
            },
          };
        }
      }

      // NEW: GroupNode - inject default functionCode if missing
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

    // Apply fallbacks if PRD was provided but AI didn't include references/test cases
    if (prdText) {
      generatedWorkflow.nodes = generatedWorkflow.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          // Add placeholder PRD reference if missing
          prdReference: node.data.prdReference || {
            section: "Unknown",
            requirement: "Not specified by AI",
            rationale: "Generated without explicit PRD reference",
          },
          // Add default test cases if missing or insufficient, and assign real UUIDs
          testCases: (node.data.testCases && node.data.testCases.length >= 3
            ? node.data.testCases
            : generateDefaultTestCases(node)
          ).map((tc) => ({ ...tc, id: `test-${uuid()}` })),
        },
      }));
    }

    // Normalize root nodes AND start node children: Start node produces no output → inputData must be null
    generatedWorkflow.nodes = generatedWorkflow.nodes.map((node) => {
      // Check if root node OR start node child
      const isRootNode = !node.parentNode;
      const parentNode = generatedWorkflow.nodes.find(
        (n) => n.id === node.parentNode,
      );
      const isStartNodeChild = parentNode?.type === "start";

      // Only normalize if root or start child
      if (!isRootNode && !isStartNodeChild) return node;

      // Extract to variables - TypeScript narrows types properly
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
              nodeData: {
                ...nodeData,
                inputData: null,
              },
            },
          },
        },
      };
    });

    return generatedWorkflow;
  } catch (error) {
    handleOpenAIError(error);
  }
};

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
