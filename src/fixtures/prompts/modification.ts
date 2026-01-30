import type { UpdateWorkflowProps } from "@/types";
import { buildPrompt } from "./utils";
import {
  CORE_NODE_TYPES,
  PARENT_CHILD_RULES,
  COMMON_VALIDATION_RULES,
  TECHNICAL_SPECIFICATION_RULES,
} from "./common";

const MODIFICATION_CONTEXT_RULES = `
MODIFICATION CONTEXT:
- You are provided with a specific **Selected Node** and its **Descendants**.
- This is your "Effective Scope". You can modify, delete, or add children to these nodes.
- You can also rewire existing nodes by updating their \`parentNode\`.

ACTIONS:
1. **create**: Add new task/service/decision nodes.
   - MUST specify \`parentNode\`.
   - If parent is Decision, MUST specify \`branchLabel\` in the \`data\` object.
2. **update**: Modify data or \`parentNode\` of existing nodes.
3. **delete**: Remove nodes from the workflow.
`;

const MODIFICATION_EXAMPLES = `
═══════════════════════════════════════════════════════════════
EXAMPLE MODIFICATIONS
═══════════════════════════════════════════════════════════════

Scenario: User selected "Task A" (id: "task-a") and asked to "Add a check before this task".

Response (Insert Decision BEFORE Task A):
{
  "nodes": {
    "create": [
      {
        "id": "new-decision", // ID Format: node-\${type}-\${uuid}
        "type": "decision",
        "parentNode": "original-parent-of-task-a", // Inherit parent of Task A
        "position": { "x": 100, "y": 100 },
        "data": { 
          "title": "Check Required?", 
          "description": "...",
          "condition": {},
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
      {
        "id": "new-bypass", // ID Format: node-\${type}-\${uuid}
        "type": "task",
        "parentNode": "new-decision",
        "position": { "x": 300, "y": 200 },
        "data": {
          "branchLabel": "no", // Decision Branch 1
          "title": "Bypass",
          "description": "Skip check",
          "assignee": "",
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
    "update": [
      {
        "id": "task-a", // ID Format: node-\${type}-\${uuid}
        "parentNode": "new-decision", // Rewire Task A to be child of Decision
        "data": {
           "branchLabel": "yes" // Decision Branch 2 (Task A becomes Yes path)
        }
      }
    ],
    "delete": []
  },
  "metadata": { "description": "Inserted decision node", "affectedNodeIds": ["task-a"] }
}

---------------------------------------------------------------

Scenario: User selected "Decision X" and said "Add a logging step to the No branch".

Response (Add node to specific branch):
{
  "nodes": {
    "create": [
      {
        "id": "new-log-service", // ID Format: node-\${type}-\${uuid}
        "type": "service",
        "parentNode": "decision-x", // Connect to selected decision
        "position": { "x": 200, "y": 400 },
        "data": {
          "branchLabel": "no", // Explicitly targeting NO port
          "title": "Log Rejection",
          "serviceType": "api",
          "http": { ... }
        }
      }
    ],
    "update": [
      // If there was an existing node on "no" branch, rewire it to be child of "new-log-service"
      {
        "id": "old-no-branch-node", // ID Format: node-\${type}-\${uuid}
        "parentNode": "new-log-service",
        "data": {
           "branchLabel": undefined // No longer direct child of decision, remove label
        }
      }
    ]
  },
  ...
}
`;

const MODIFICATION_RESPONSE_FORMAT = `
RESPONSE FORMAT (JSON):
{
  "nodes": {
    "create": [ ...Array of new Nodes (task, service, decision) ],
    "update": [ { "id": "...", "parentNode": "...", "data": {...} } ],
    "delete": [ "node-id-1", "node-id-2" ]
  },
  "metadata": { ... }
}

DO NOT generate Start/End nodes.
DO NOT generate Edges.
`;

// export const MODIFICATION_SCOPE_RULES = `
// ═══════════════════════════════════════════════════════════════
// 🛠️ MODIFICATION & RESTRUCTURING RULES
// ═══════════════════════════════════════════════════════════════

// 1. **Effective Scope Definition**
//    - The "Selected Node" and ALL its "Descendants" (children, grandchildren, etc.) are within your control.
//    - You are NOT required to preserve existing descendant nodes if the user's request implies a structural change.

// 2. **Active Use of DELETE**
//    - If a user asks to "Replace steps" or "Change logic", DO NOT just append new nodes.
//    - Add the IDs of unnecessary existing descendant nodes to the \`delete\` array.
//    - Then, \`create\` new nodes or \`update\` others to form the requested logic.

// 3. **Restructuring Example**
//    - Current: A -> B -> C (Selected: A)
//    - Request: "Make A branch into D and E instead of going to B."
//    - Action:
//      - \`delete\`: ["B", "C"] (If they are no longer needed)
//      - \`update\`: Node "A" (Change to type: "decision")
//      - \`create\`: Node "D" (parent: "A", branch: "yes"), Node "E" (parent: "A", branch: "no")
// `;

export const MODIFICATION_PROMPT_CONTENT = `
${CORE_NODE_TYPES}

${MODIFICATION_CONTEXT_RULES}

${PARENT_CHILD_RULES}

${MODIFICATION_RESPONSE_FORMAT}

${MODIFICATION_EXAMPLES}

${COMMON_VALIDATION_RULES}

${TECHNICAL_SPECIFICATION_RULES}
`;

export const MODIFICATION_SYSTEM_PROMPT = buildPrompt({
  operation: "modification",
  promptContent: MODIFICATION_PROMPT_CONTENT,
});

export function getModificationContent({
  nodeId,
  prompt,
  nodes,
}: Omit<UpdateWorkflowProps, "apiKey">): string {
  // Basic context preparation logic handled by caller, just passing prompt
  // Ideally you would serialize the 'effective scope' here.
  return `
USER REQUEST: ${prompt}
SELECTED NODE ID: ${nodeId}
EXISTING NODES (Scope): ${JSON.stringify(nodes, null, 2)}

Provide the JSON for creation, update, and deletion of nodes.
`;
}

export function buildEditResultSchema() {
  return {
    type: "object",
    properties: {
      nodes: {
        type: "object",
        properties: {
          update: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                data: { type: "object" },
              },
              required: ["id", "data"],
              additionalProperties: false,
            },
          },
          create: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: {
                  type: "string",
                  enum: ["task", "decision", "service", "end"],
                },
                parentNode: { type: "string" },
                data: { type: "object" },
                position: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                  },
                  required: ["x", "y"],
                  additionalProperties: false,
                },
              },
              required: ["id", "type", "data", "position"],
              additionalProperties: false,
            },
          },
          delete: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
      metadata: {
        type: "object",
        properties: {
          description: { type: "string" },
          affectedNodeIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["description", "affectedNodeIds"],
        additionalProperties: false,
      },
    },
    required: ["nodes", "edges", "metadata"],
    additionalProperties: false,
  };
}
