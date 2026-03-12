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
  DecisionNodeData,
  GroupNode,
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
  validateParentNodeCycles,
  validateCircularReferences,
} from "@/contexts/WorkflowGenerator/validators/circularReference";
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

    // Detect and auto-fix circular parentNode cycles (max 3 retries)
    const MAX_CIRCULAR_FIX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_CIRCULAR_FIX_RETRIES; attempt++) {
      const cycleResult = validateParentNodeCycles(nodes);
      const groupCycleResult = validateCircularReferences(nodes);

      if (cycleResult.valid && groupCycleResult.valid) break;

      if (attempt === MAX_CIRCULAR_FIX_RETRIES - 1) {
        throw new Error(
          `Failed to resolve circular parentNode cycles after ${MAX_CIRCULAR_FIX_RETRIES} retries`,
        );
      }

      console.warn(
        `[generateWorkflowAction] Circular parentNode cycle detected (attempt ${attempt + 1}/${MAX_CIRCULAR_FIX_RETRIES}), requesting AI fix...`,
      );

      const affectedNodes = [
        ...(cycleResult.affectedNodes ?? []),
        ...(groupCycleResult.affectedNodes ?? []),
      ];

      const fixPrompt = buildCircularCycleFixPrompt(nodes, affectedNodes);
      const firstAffectedId = affectedNodes[0]?.id ?? nodes[0].id;

      const editResult = await updateWorkflowAction(
        firstAffectedId,
        fixPrompt,
        nodes,
      );

      if (editResult.nodes.update?.length) {
        editResult.nodes.update.forEach((update) => {
          const idx = nodes.findIndex((n) => n.id === update.id);
          if (idx >= 0) {
            nodes[idx] = {
              ...nodes[idx],
              data: { ...nodes[idx].data, ...update.data },
              parentNode: update.parentNode ?? nodes[idx].parentNode,
            };
          }
        });
      }
      if (editResult.nodes.create?.length) {
        nodes = [...nodes, ...editResult.nodes.create];
      }
      if (editResult.nodes.delete?.length) {
        const deleteIds = new Set(editResult.nodes.delete);
        nodes = nodes.filter((n) => !deleteIds.has(n.id));
      }

      nodes = populateGroupChildren(nodes);
    }

    nodes = removeUndersizedGroups(nodes);
    nodes = normalizeNodeDefaults(nodes);
    nodes = normalizeStartInputData(nodes);
    nodes = normalizeNodeChaining(nodes);
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

function buildCircularCycleFixPrompt(
  nodes: WorkflowNode[],
  affectedNodes: WorkflowNode[],
): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const descriptions = affectedNodes
    .map((node) => {
      const parent = node.parentNode ? nodeMap.get(node.parentNode) : undefined;
      return (
        `- "${node.data?.title ?? node.id}" (id: ${node.id}, type: ${node.type}) ` +
        `has parentNode → "${parent?.data?.title ?? node.parentNode}" (id: ${node.parentNode})`
      );
    })
    .join("\n");

  return (
    `CRITICAL BUG: Circular parentNode cycle detected!\n\n` +
    `The following nodes form a mutual parentNode reference cycle (A.parentNode = B, B.parentNode = A):\n` +
    descriptions +
    `\n\nThis causes "Maximum call stack size exceeded" during rendering.\n\n` +
    `FIX REQUIRED: Break the cycle by removing or correcting the parentNode of one of the involved nodes.\n` +
    `RULES:\n` +
    `- parentNode must only point UP the hierarchy (to a containing group or task)\n` +
    `- Two nodes must NEVER mutually reference each other as parents\n` +
    `- Make one of the involved nodes a root node (remove its parentNode) or re-parent it to a different valid ancestor`
  );
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

/** Set nodeData.inputData on a node immutably; no-ops if config.nodeData is absent. */
function setNodeInputData(
  node: WorkflowNode,
  inputData: unknown,
): WorkflowNode {
  if (!node.data.execution?.config?.nodeData) return node;
  return {
    ...node,
    data: {
      ...node.data,
      execution: {
        ...node.data.execution,
        config: {
          ...node.data.execution.config,
          nodeData: {
            ...node.data.execution.config.nodeData,
            inputData,
          },
        },
      },
    },
  };
}

/**
 * Enforce inputData/outputData chaining rules across all non-start nodes.
 *
 * Rules:
 *   GroupNode.nodeData.inputData        = parent.outputData
 *   groups[0].nodeData.inputData        = parent.outputData  (same as GroupNode)
 *   groups[i].nodeData.inputData (i≥1)  = groups[i-1].nodeData.outputData
 *   task/service/decision.nodeData.inputData = parent.outputData
 *
 * Nodes whose parent is start or absent are skipped (handled by normalizeStartInputData).
 * Internal group nodes in the outer array are also skipped; they are updated inside
 * the group's own processing.
 */
function normalizeNodeChaining(nodes: WorkflowNode[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return nodes.map((node) => {
    const parent = node.parentNode ? nodeMap.get(node.parentNode) : null;

    // Root nodes and start-node children are handled by normalizeStartInputData
    if (!parent || parent.type === "start") return node;

    // Internal nodes whose parent is a group are handled within the group's own processing
    if (parent.type === "group") return node;

    const parentOutputData =
      parent.data.execution?.config?.nodeData?.outputData ?? null;

    if (node.type === "group") {
      const groupData = node.data as GroupNodeData;
      const originalGroups = groupData.groups || [];
      const processedGroups: WorkflowNode[] = [];

      for (let idx = 0; idx < originalGroups.length; idx++) {
        const inputData =
          idx === 0
            ? parentOutputData
            : (originalGroups[idx - 1]?.data?.execution?.config?.nodeData
                ?.outputData ?? null);
        processedGroups.push(setNodeInputData(originalGroups[idx], inputData));
      }

      return {
        ...node,
        data: {
          ...node.data,
          groups: processedGroups,
          execution: {
            ...node.data.execution,
            config: {
              functionCode: "",
              ...node.data.execution?.config,
              nodeData: {
                ...node.data.execution?.config?.nodeData,
                inputData: parentOutputData,
              },
            },
          },
        },
      } satisfies {
        data: Partial<GroupNode["data"]>;
      };
    }

    // task / service / decision whose parent is task / service / decision
    return setNodeInputData(node, parentOutputData);
  });
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
