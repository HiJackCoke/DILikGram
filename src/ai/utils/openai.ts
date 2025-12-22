/**
 * OpenAI API client for workflow generation
 *
 * Uses GPT-4o-mini model with structured JSON output to generate
 * workflow diagrams from natural language descriptions.
 */

import type { GeneratedWorkflow } from "@/types";

/**
 * System prompt that instructs OpenAI how to generate workflows
 */
const SYSTEM_PROMPT = `You are a workflow design assistant. Generate structured workflow diagrams based on user descriptions.

Available Node Types:
1. start: Workflow entry point (1 per workflow, has output port)
2. end: Workflow exit point (can have multiple, has input port, status: success/failure/neutral)
3. task: General work items (has input/output ports, includes title, description, assignee)
4. decision: Branching logic (has input port, yes/no output ports)
5. service: External service calls (has input/output ports, includes API config)

Port Configuration:
- start nodes: only "output" port
- end nodes: only "input" port
- task nodes: "input" and "output" ports
- decision nodes: "input" port, "yes" and "no" output ports
- service nodes: "input" and "output" ports

Rules:
- Do not generate or leave any isolated nodes; each node must participate in the flow with at least one edge
- Always start with exactly 1 start node
- Include at least 1 end node (status: success/failure based on context)
- Use decision nodes for conditional logic, branching, or validation
- Use service nodes for external API calls, database operations, webhooks
- Use task nodes for general processing, transformations, assignments
- Ensure all nodes are connected in a logical flow
- Generate clear, descriptive titles (keep them concise, under 40 characters)
- Position nodes in a vertical flow (top-to-bottom)
- Use sourcePort and targetPort correctly:
  - start → task/decision/service: sourcePort="output", targetPort="input"
  - task → task/decision/service: sourcePort="output", targetPort="input"
  - decision → task/service/end: sourcePort="yes" or "no", targetPort="input"
  - service → task/decision/end: sourcePort="output", targetPort="input"
  - any → end: targetPort="input"

Response Format:
Return ONLY valid JSON with this structure:
{
  "nodes": [
    {
      "type": "start" | "end" | "task" | "decision" | "service",
      "title": "string",
      "description": "string (optional)",
      "position": { "x": 0, "y": 0 },

      // For end nodes:
      "status": "success" | "failure" | "neutral",

      // For decision nodes:
      "condition": { "has": "fieldName" } or { "truthy": "fieldName" },

      // For service nodes:
      "serviceType": "api" | "database" | "email" | "webhook",
      "http": { "method": "GET" | "POST" | "PUT" | "DELETE", "endpoint": "/api/path" },

      // For task nodes:
      "assignee": "string (optional)"
    }
  ],
  "edges": [
    {
      "sourceIndex": 0,
      "targetIndex": 1,
      "sourcePort": "output" | "yes" | "no",
      "targetPort": "input"
    }
  ],
  "metadata": {
    "description": "Brief workflow summary",
    "estimatedComplexity": "simple" | "moderate" | "complex"
  }
}

Do NOT include markdown code blocks, explanations, or any text outside the JSON object.`;

/**
 * Generate user prompt with context about existing nodes
 */
function generateUserPrompt(
  userDescription: string,
  existingNodeCount: number
): string {
  const context =
    existingNodeCount > 0
      ? `\n\nNote: This workflow will be added to an existing canvas with ${existingNodeCount} nodes. Position nodes to avoid overlap.`
      : "";

  return `${userDescription}${context}`;
}

/**
 * Generate a workflow using OpenAI GPT-4o-mini
 *
 * @param apiKey - User's OpenAI API key
 * @param prompt - Natural language description of desired workflow
 * @param existingNodeCount - Number of existing nodes on canvas (for positioning context)
 * @returns Generated workflow with nodes and edges
 * @throws Error if API call fails or response is invalid
 */
export async function generateWorkflow(
  apiKey: string,
  prompt: string,
  existingNodeCount: number = 0
): Promise<GeneratedWorkflow> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API key is required");
  }

  if (!prompt || !prompt.trim()) {
    throw new Error("Workflow description is required");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: generateUserPrompt(prompt, existingNodeCount),
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Invalid API key. Please check your OpenAI API key and try again."
        );
      }
      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment and try again."
        );
      }
      if (response.status === 500) {
        throw new Error("OpenAI service error. Please try again later.");
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Invalid response from OpenAI API");
    }

    const generatedWorkflow = JSON.parse(data.choices[0].message.content);

    // Basic validation
    if (!generatedWorkflow.nodes || !Array.isArray(generatedWorkflow.nodes)) {
      throw new Error("Generated workflow missing nodes array");
    }

    if (!generatedWorkflow.edges || !Array.isArray(generatedWorkflow.edges)) {
      throw new Error("Generated workflow missing edges array");
    }

    return generatedWorkflow as GeneratedWorkflow;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to generate workflow. Please try again.");
  }
}
