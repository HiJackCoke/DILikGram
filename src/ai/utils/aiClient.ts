/**
 * OpenAI API client for workflow generation and incremental editing
 *
 * Consolidated API client supporting both:
 * - Workflow generation (GPT-4o-mini with structured JSON output)
 * - Incremental workflow editing (GPT-4o with JSON schema validation)
 */

import {
  GENERATION_SYSTEM_PROMPT,
  getGenerationContent,
} from "@/fixtures/prompts/generation";
import {
  buildEditResultSchema,
  getModificationContent,
  MODIFICATION_SYSTEM_PROMPT,
} from "@/fixtures/prompts/modification";

import type { GenerateWorkflowResponse } from "@/types";
import type {
  UpdateWorkflow,
  UpdateWorkflowResponse,
  FetchOpenAI,
  GenerateWorkflow,
} from "@/types/ai";

// ============================================================================
// SECTION 1: SHARED OPENAI CLIENT LOGIC (DEDUPLICATED)
// ============================================================================

async function fetchOpenAI<T>({
  apiKey,
  messages,
  model,
  jsonSchema,
}: FetchOpenAI): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6, // Balanced for diversity while maintaining coherence
      response_format: jsonSchema
        ? {
            type: "json_schema",
            json_schema: jsonSchema,
          }
        : { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw handleAPIError(response);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Invalid response from OpenAI API");
  }

  return JSON.parse(data.choices[0].message.content) as T;
}

/**
 * Handle OpenAI API errors with user-friendly messages
 *
 * @param response - Fetch response object
 * @returns Error with appropriate message
 */
function handleAPIError(response: Response): Error {
  if (response.status === 401) {
    return new Error(
      "Invalid API key. Please check your OpenAI API key and try again."
    );
  }
  if (response.status === 429) {
    return new Error(
      "Rate limit exceeded. Please wait a moment and try again."
    );
  }
  if (response.status === 500) {
    return new Error("OpenAI service error. Please try again later.");
  }

  // Try to extract error message from response body
  return new Error(
    `OpenAI API error: ${response.status} ${response.statusText}`
  );
}

// ============================================================================
// SECTION 4: PUBLIC API
// ============================================================================

export const generateWorkflow: GenerateWorkflow = async ({
  apiKey,
  prompt,
}) => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API key is required");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Workflow description is required");
  }

  try {
    const generatedWorkflow = await fetchOpenAI<GenerateWorkflowResponse>({
      apiKey,
      messages: [
        { role: "system", content: GENERATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: getGenerationContent(prompt),
        },
      ],
      model: "gpt-4o-mini",
    });

    // Basic validation
    if (!generatedWorkflow.nodes || !Array.isArray(generatedWorkflow.nodes)) {
      throw new Error("Generated workflow missing nodes array");
    }

    return generatedWorkflow;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to generate workflow. Please try again.");
  }
};

/**
 * Edit workflow using OpenAI GPT-4o
 *
 * @param apiKey - User's OpenAI API key
 * @param prompt - User's edit request
 * @param context - Current workflow context (target nodes, edges, parents)
 * @returns Incremental edit nodes to apply
 * @throws Error if API call fails or response is invalid
 */
export const updateWorkflow: UpdateWorkflow = async ({
  apiKey,
  nodeId,
  prompt,
  nodes,
}) => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API key is required");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Edit description is required");
  }

  try {
    const editResult = await fetchOpenAI<UpdateWorkflowResponse>({
      apiKey,
      messages: [
        { role: "system", content: MODIFICATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: getModificationContent({
            prompt,
            nodeId,
            nodes,
          }),
        },
      ],
      model: "gpt-4o-mini",
      jsonSchema: {
        name: "workflow_edit",
        schema: buildEditResultSchema(),
      },
    });

    // Basic validation with detailed error messages
    if (!editResult.nodes) {
      console.error("OpenAI response:", editResult);
      throw new Error(
        "Edit result missing nodes. Check console for full response."
      );
    }

    // Validate metadata presence - generate fallback if missing
    if (!editResult.metadata) {
      console.warn("OpenAI did not return metadata. Response:", editResult);

      // Generate default metadata as fallback
      const affectedNodeIds = new Set<string>();

      // Collect affected node IDs from nodes
      editResult.nodes?.update?.forEach((op) => affectedNodeIds.add(op.id));
      editResult.nodes?.create?.forEach((node) => affectedNodeIds.add(node.id));
      editResult.nodes?.delete?.forEach((id) => affectedNodeIds.add(id));

      editResult.metadata = {
        description: "Workflow modified (metadata not provided by AI)",
        affectedNodeIds: Array.from(affectedNodeIds),
      };

      console.warn("Generated fallback metadata:", editResult.metadata);
    }

    return editResult;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to edit workflow. Please try again.");
  }
};
