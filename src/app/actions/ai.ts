"use server";

/**
 * Server Actions for AI-powered workflow operations
 *
 * Security: API calls are made server-side with environment variable API key
 * All functions use Next.js Server Actions pattern
 */

import OpenAI from "openai";
import type { GenerateWorkflowResponse, UpdateWorkflowResponse } from "@/types/ai";
import type { WorkflowNode } from "@/types/nodes";
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
        "Please add it to your .env.local file."
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
        "Invalid OpenAI API key. Please check your environment configuration."
      );
    }
    if (error.status === 429) {
      throw new Error(
        "OpenAI rate limit exceeded. Please try again in a moment."
      );
    }
    if (error.status === 500 || error.status === 503) {
      throw new Error(
        "OpenAI service temporarily unavailable. Please try again later."
      );
    }

    throw new Error(`OpenAI API error: ${error.message}`);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("An unexpected error occurred while processing your request.");
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Generate workflow from prompt using GPT-4o-mini
 *
 * @param prompt - User's workflow description
 * @returns Generated workflow with nodes and metadata
 */
export async function generateWorkflowAction(
  prompt: string
): Promise<GenerateWorkflowResponse> {
  if (!prompt || !prompt.trim()) {
    throw new Error("Workflow description is required");
  }

  try {
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: GENERATION_SYSTEM_PROMPT },
        { role: "user", content: getGenerationContent(prompt) },
      ],
      temperature: 0.6,
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

    return generatedWorkflow;
  } catch (error) {
    handleOpenAIError(error);
  }
}

/**
 * Update workflow using GPT-4o-mini with incremental edits
 *
 * @param nodeId - Target node ID to edit
 * @param prompt - User's edit instructions
 * @param nodes - Current workflow nodes
 * @returns Incremental edit operations (update/create/delete)
 */
export async function updateWorkflowAction(
  nodeId: string,
  prompt: string,
  nodes: WorkflowNode[]
): Promise<UpdateWorkflowResponse> {
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
}
