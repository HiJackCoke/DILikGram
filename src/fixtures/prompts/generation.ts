import { buildPrompt } from "./utils";
import {
  CORE_NODE_TYPES,
  PARENT_CHILD_RULES,
  COMMON_VALIDATION_RULES,
} from "./common";

/**
 * Generation-specific examples
 */
const GENERATION_EXAMPLES = `
═══════════════════════════════════════════════════════════════
EXAMPLE OUTPUTS (JSON)
═══════════════════════════════════════════════════════════════

User: "Create a document review process where if approved it goes to shipping, otherwise back to draft."

{
  "nodes": [
    // 1. Root Node (No parentNode)
    {
      "id": "node-\${type}-\${uuid}",
      "type": "task",
      "position": { "x": 0, "y": 0 },
      "data": {
        "title": "Review Document",
        "description": "Check for errors",
        "assignee": "Manager",
        "estimatedTime": 30,
        "metadata": {},
        "ports": [
          {
              "id": "input",
              "position": "top",
              "type": "target"
          },
          {
              "id": "output",
              "position": "bottom",
              "type": "source"
          }
        ]
      }
    },
    // 2. Decision Node (Parent is Review)
    {
      "id": "node-\${type}-\${uuid}",
      "type": "decision",
      "parentNode": "node-review",
      "position": { "x": 0, "y": 150 },
      "data": {
        "title": "Approved?",
        "description": "Is document valid?",
        "condition": { "field": "status", "op": "eq", "value": "approved" },
        "mode": "panel",
        "ports": [
          {
              "id": "input",
              "position": "top",
              "type": "target"
          },
          {
              "id": "yes",
              "position": "right",
              "type": "source",
              "label": "Yes"
          },
          {
              "id": "no",
              "position": "bottom",
              "type": "source",
              "label": "No"
          }
        ]
      }
    },
    // 3. Yes Branch (Parent is Decision)
    {
      "id": "node-\${type}-\${uuid}",
      "type": "service",
      "parentNode": "node-check",
      "position": { "x": 200, "y": 300 },
      "data": {
        "branchLabel": "yes",  // REQUIRED
        "title": "Initiate Shipping",
        "description": "Call shipping API",
        "serviceType": "api",
        "http": { "method": "POST", "endpoint": "/ship" },
        "ports": [
          {
              "id": "input",
              "position": "top",
              "type": "target"
          },
          {
              "id": "output",
              "position": "bottom",
              "type": "source"
          }
        ]
      }
    },
    // 4. No Branch (Parent is Decision)
    {
      "id": "node-\${type}-\${uuid}",
      "type": "task",
      "parentNode": "node-check",
      "position": { "x": -200, "y": 300 },
      "data": {
        "branchLabel": "no",   // REQUIRED
        "title": "Return to Draft",
        "description": "Send back to author",
        "assignee": "Author",
        "estimatedTime": 0,
        "metadata": {},
        "ports": [
          {
              "id": "input",
              "position": "top",
              "type": "target"
          },
          {
              "id": "output",
              "position": "bottom",
              "type": "source"
          }
        ]
      }
    }
  ],
  "metadata": {
    "description": "Review process with approval logic",
    "estimatedComplexity": "moderate"
  }
}
`;

const GENERATION_RESPONSE_FORMAT = `
RESPONSE FORMAT:

Return a JSON object with a "nodes" array.

1. **First Node**: This is your entry point. DO NOT specify \`parentNode\` for this node.
2. **Subsequent Nodes**: MUST specify \`parentNode\` (referencing an ID from your list).
3. **Fields**:
   - **task**: id, type="task", parentNode, position, data: { title, description, assignee, estimatedTime, metadata, ports, [branchLabel] }
   - **service**: id, type="service", parentNode, position, data: { title, description, serviceType, http?, ports, [branchLabel] }
   - **decision**: id, type="decision", parentNode, position, data: { title, description, condition, mode, ports, [branchLabel] }

DO NOT generate Start ("start") or End ("end") nodes.
DO NOT generate "edges".
`;

export const GENERATION_PROMPT_CONTENT = `
${CORE_NODE_TYPES}

${PARENT_CHILD_RULES}

${GENERATION_RESPONSE_FORMAT}

${GENERATION_EXAMPLES}

${COMMON_VALIDATION_RULES}
`;

export const GENERATION_SYSTEM_PROMPT = buildPrompt({
  operation: "generation",
  promptContent: GENERATION_PROMPT_CONTENT,
});

export function getGenerationContent(prompt: string): string {
  return `Create a workflow based on this request: "${prompt}"\n\nRemember: No Start/End nodes, No Edges. Use parentNode logic.`;
}
