import { buildPrompt } from "./utils";
import {
  CORE_NODE_TYPES,
  PARENT_CHILD_RULES,
  COMMON_VALIDATION_RULES,
  TECHNICAL_SPECIFICATION_RULES,
  SERVICE_NODE_MOCK_DATA_RULES,
} from "./common";
import { buildPRDContext } from "@/utils/prd/contextBuilder";
import { GenerateWorkflowAction } from "@/types";

/**
 * PRD-based generation rules
 */
const PRD_GENERATION_RULES = `
═══════════════════════════════════════════════════════════════
PRD-BASED WORKFLOW GENERATION RULES
═══════════════════════════════════════════════════════════════

1. GROUP NODES ARE MANDATORY — ONE PER FEATURE (1:1 MAPPING)
   - EVERY feature from the PRD analysis MUST become a GroupNode — no exceptions
   - GroupNode.title = exact feature name, GroupNode.description = feature description
   - EVERY GroupNode MUST contain at least 2 internal child nodes (Task/Service/Decision)
   - Even "simple" features need a GroupNode: TaskNode(validate/prepare) + ServiceNode(execute) at minimum
   - Complex features: TaskNode + ServiceNode + DecisionNode(success/failure branch)
   - ✅ Correct: "Send Email Notification" → GroupNode { TaskNode(prepare payload) + ServiceNode(POST /email) }
   - ❌ Wrong: skipping GroupNode and using a bare ServiceNode or TaskNode directly
   - Feature count in analysis = GroupNode count you generate (4 features → 4 GroupNodes, mandatory)

2. START NODE CHILDREN (CRITICAL)
   - Start nodes produce NO OUTPUT
   - Nodes with \`parentNode: <start-node-id>\` MUST have:
     * execution.config.nodeData.inputData: null
     * functionCode that does NOT reference inputData fields
   - ❌ WRONG:
     {
       "parentNode": "node-start-abc123",
       "data": {
         "execution": {
           "config": {
             "functionCode": "return inputData.tasks;",
             "nodeData": { "inputData": { "tasks": [] } }
           }
         }
       }
     }
   - ✅ CORRECT:
     {
       "parentNode": "node-start-abc123",
       "data": {
         "execution": {
           "config": {
             "functionCode": "return []; // init from scratch",
             "nodeData": { "inputData": null }
           }
         }
       }
     }

3. FUNCTIONCODE EXECUTION SCOPE (CRITICAL)
   - functionCode executes in a sandboxed environment with ONLY these variables:
     * \`inputData\` - Output from parent node
     * \`fetch\` - Global fetch API
   - NO OTHER VARIABLES ARE ACCESSIBLE:
     - ❌ \`metadata\` is NOT in scope (it's at node.data.metadata, not accessible)
     - ❌ \`node\` is NOT in scope (no access to node object)
     - ❌ \`config\` is NOT in scope (no access to execution config)
     - ❌ \`this\` is NOT bound (no context)
   - **How to handle configuration values:**
     - BAD: Try to access \`metadata.maxTasks\` in functionCode
       \`\`\`javascript
       // ❌ WRONG - metadata is not in scope!
       return { tasks: inputData.tasks.slice(0, metadata.maxTasks) };
       \`\`\`
     - GOOD: Pass config values explicitly in inputData
       \`\`\`javascript
       // ✅ CORRECT - maxTasks passed via inputData
       // inputData: { tasks: [...], maxTasks: 3 }
       return { tasks: inputData.tasks.slice(0, inputData.maxTasks) };
       \`\`\`
   - **Example - Task selection with limit:**
     \`\`\`json
     {
       "data": {
         "metadata": { "maxTasks": 3 },  // Stored in metadata for documentation
         "execution": {
           "config": {
             "functionCode": "return { tasks: inputData.tasks.slice(0, inputData.maxTasks) };",
             "nodeData": {
               "inputData": {
                 "tasks": ["Task 1", "Task 2"],
                 "maxTasks": 3  // Pass limit via inputData!
               },
               "outputData": { "tasks": ["Task 1", "Task 2"] }
             }
           }
         }
       }
     }
     \`\`\`
   - **INPUT DATA TYPE DEFAULTS (CRITICAL)**:
     - nodeData.inputData sample values MUST use proper type defaults, NOT null as placeholders:
       - Arrays → use \`[]\` (not null)
       - Objects → use \`{}\` (not null)
       - Strings → use \`""\` (not null)
       - Numbers → use \`0\` (not null)
     - \`null\` is ONLY valid for \`nodeData.inputData\` itself (start node children)
     - ❌ Wrong: \`"nodeData": { "inputData": { "tasks": null } }\`
     - ✅ Correct: \`"nodeData": { "inputData": { "tasks": [] } }\`

4. PRD REFERENCES (REQUIRED FOR EVERY NODE)
   - Every node MUST include prdReference field with:
     * section: Section title from PRD (e.g., "User Authentication", "Payment Flow")
     * requirement: Exact requirement text from PRD
     * rationale: Clear explanation of why this node implements this requirement
   - Example:
     {
       "prdReference": {
         "section": "User Authentication",
         "requirement": "System must validate user email and password",
         "rationale": "This task node validates input before API call to ensure data integrity"
       }
     }

5. TEST CASES (MINIMUM 3 PER NODE)
   - Every node MUST include testCases array with at least 3 test cases
   - Cover: success case, failure case, edge case
   - Format:
     {
       "testCases": [
         {
           "id": "test-550e8400-e29b-41d4-a716-446655440001",
           "name": "Valid credentials",
           "description": "Test successful login with correct email/password",
           "inputData": { "email": "user@test.com", "password": "Pass123!" },
           "expectedOutput": { "success": true, "token": "mock-token" }
         },
         {
           "id": "test-550e8400-e29b-41d4-a716-446655440002",
           "name": "Invalid password",
           "description": "Test login failure with wrong password",
           "inputData": { "email": "user@test.com", "password": "wrong" },
           "expectedOutput": { "success": false, "error": "Invalid credentials" }
         },
         {
           "id": "test-550e8400-e29b-41d4-a716-446655440003",
           "name": "Missing email",
           "description": "Test validation with missing required field",
           "inputData": { "password": "Pass123!" },
           "expectedOutput": { "success": false, "error": "Email is required" }
         }
       ]
     }

6. REUSE EXISTING NODES FROM LIBRARY
   - Prioritize reusing nodes from the provided node library
   - Only create new nodes if no suitable library node exists
   - When reusing, maintain the node's structure but add/update prdReference
   - Increment usageCount for reused nodes

7. FUNCTIONAL PROGRAMMING STYLE
   - GroupNode = Feature unit (stateless, composable)
   - Internal nodes = Pure functions (task/service/decision)
   - Data flows sequentially through internal nodes
   - Each node should have single responsibility
   - Avoid side effects in TaskNodes (use ServiceNodes for external calls)
   - **EVERY internal node (task/service) inside a GroupNode MUST have execution.config.functionCode**
   - A task that just forwards data: \`functionCode = "return inputData;"\`
   - ❌ Wrong internal task: \`{ "execution": { "config": { "nodeData": {...} } } }\`  // no functionCode!
   - ❌ Wrong: nodeData.inputData sample uses template syntax \`"{{inputData.key}}"\`
   - ✅ Correct: nodeData.inputData uses actual sample values: \`{ "taskId": "mock-task-id" }\`

   **GroupNode initFunctionCode (MANDATORY)**:
   - EVERY GroupNode MUST have execution.config with initFunctionCode
   - It transforms the parent's output into the shape expected by the first internal node
   - DATA CONTRACT:
       GroupNode receives from parent → initFunctionCode → first internal node's inputData
       parent.nodeData.outputData shape → initFunctionCode maps keys → groups[0].nodeData.inputData shape
   - ❌ Wrong: first internal node expects { tasks } but parent outputs { currentDate } with no initFunctionCode → runtime crash
   - ✅ Correct:
       \`"initFunctionCode": "return { date: inputData?.currentDate ?? '', tasks: [] };"\`
   - If parent output already has the right shape: \`"return inputData;"\`
   - Always use optional chaining (inputData?.field ?? default) to be null-safe
   - Example GroupNode execution.config:
     \`\`\`json
     {
       "execution": {
         "config": {
           "initFunctionCode": "return { date: inputData?.currentDate ?? '', tasks: [] };",
           "functionCode": "return { tasks: Array.isArray(inputData?.tasks) ? inputData.tasks : [] };",
           "nodeData": {
             "inputData": { "currentDate": "2026-01-01" },
             "outputData": { "tasks": [] }
           }
         }
       }
     }
     \`\`\`

8. ROOT/PARENT TASK NODE EXECUTION CONFIG (MANDATORY)
   - ALL task nodes — including root nodes and parent-of-group nodes — MUST have execution.config
   - Root task nodes (no parentNode or parentNode is start node):
     * functionCode that initializes state (does NOT reference inputData fields)
     * nodeData.inputData: null
     * nodeData.outputData: the exact data structure that child nodes expect as inputData
   - Parent task nodes (whose children are GroupNodes):
     * nodeData.outputData MUST be semantically compatible with the GroupNode's expected inputData
   - ❌ WRONG: root task node with NO execution field → children receive null inputData → TypeError
   - ✅ CORRECT:
     \`\`\`json
     {
       "type": "task",
       "data": {
         "title": "Initialize Process",
         "execution": {
           "config": {
             "functionCode": "return { userId: 'user-001', items: [] };",
             "nodeData": {
               "inputData": null,
               "outputData": { "userId": "user-001", "items": [] }
             }
           }
         }
       }
     }
     \`\`\`

9. TEST CASE inputData MUST MATCH EXECUTION CONFIG STRUCTURE (MANDATORY)
   - The success case testCase.inputData MUST match execution.config.nodeData.inputData — NOT just \`{}\`
   - A testCase with \`"inputData": {}\` while the functionCode references \`inputData.userId\` will fail
   - ❌ WRONG: \`"inputData": {}\` for a node whose functionCode uses \`inputData.userId\`
   - ✅ CORRECT: \`"inputData": { "userId": "user-001" }\` matching the actual inputData structure

10. GROUP NODE INTERNAL DATA CHAIN (MANDATORY)
   - GroupNode internal nodes pass data sequentially: node[0] → node[1] → ... → node[N]
   - Each internal node's nodeData.inputData MUST match the keys of the preceding node's nodeData.outputData
   - DATA CONTRACT:
     node[i].functionCode returns { key1, key2 }
       → node[i].nodeData.outputData = { key1: ..., key2: ... }
       → node[i+1].nodeData.inputData = { key1: ..., key2: ... }
       → node[i+1].functionCode reads inputData.key1, inputData.key2

   - ❌ Wrong (node[0] outputs tasks, but node[1] reads displayedTasks):
     node[0].functionCode: "return { tasks: [...] };"
     node[1].functionCode: "return { result: inputData.displayedTasks.length };"
                                               // ^^^^^^^^^^^^^^^^ key mismatch!

   - ✅ Correct:
     node[0].functionCode: "return { tasks: [...] };"
     node[0].nodeData.outputData: { tasks: [] }
     node[1].nodeData.inputData: { tasks: [] }           // same key as node[0] output
     node[1].functionCode: "return { displayedTasks: Array.isArray(inputData?.tasks) ? inputData.tasks.slice(0, 3) : [] };"
     node[1].nodeData.outputData: { displayedTasks: [] }
`;

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
      "id": "node-task-review-001",
      "type": "task",
      "position": { "x": 0, "y": 0 },
      "data": {
        "title": "Review Document",
        "description": "Check for errors",
        "assignee": "Manager",
        "estimatedTime": 30,
        "metadata": {},
        "execution": {
          "config": {
            "functionCode": "return { documentId: 'DOC-001', status: 'pending_review', isApproved: true };",
            "nodeData": {
              "inputData": null,
              "outputData": { "documentId": "DOC-001", "status": "pending_review", "isApproved": true }
            }
          }
        },
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
    // 2. Decision Node (Parent is Review → parentNode matches node 1's id exactly)
    {
      "id": "node-decision-check-002",
      "type": "decision",
      "parentNode": "node-task-review-001",
      "position": { "x": 0, "y": 150 },
      "data": {
        "title": "Approved?",
        "description": "Is document valid?",
        "condition": { "truthy": "isApproved" },
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
    // 3. Yes Branch (Parent is Decision → parentNode matches node 2's id exactly)
    {
      "id": "node-service-ship-003",
      "type": "service",
      "parentNode": "node-decision-check-002",
      "position": { "x": 200, "y": 300 },
      "data": {
        "branchLabel": "yes",  // REQUIRED
        "title": "Initiate Shipping",
        "description": "Call shipping API to create shipment",
        "mode": "panel",
        "serviceType": "api",
        "timeout": 10000,
        "retry": { "retry": 0, "delay": 3000 },
        "http": {
          "method": "POST",
          "endpoint": "/api/shipping",
          "headers": { "Content-Type": "application/json" },
          "body": { "orderId": "{{inputData.orderId}}", "address": "{{inputData.address}}" }
        },
        "execution": {
          "config": {
            "functionCode": "const headers = { \\"Content-Type\\": \\"application/json\\" }\\nconst body = { orderId: inputData.orderId, address: inputData.address }\\nconst endpoint = \\"/api/shipping\\"\\nconst method = \\"POST\\"\\n\\ntry {\\n  const response = await fetch(endpoint, {\\n    method,\\n    headers,\\n    body: JSON.stringify(body),\\n  })\\n\\n  if (!response.ok) {\\n    throw new Error(\`HTTP Error: \${response.status} \${response.statusText}\`)\\n  }\\n\\n  return await response.json()\\n} catch (error) {\\n  throw new Error(\`API Request Failed: \${error.message}\`)\\n}",
            "isAsync": true,
            "nodeData": {
              "inputData": { "orderId": "ORD-123", "address": "123 Main St" },
              "outputData": { "success": true, "trackingNumber": "TRACK-456" }
            },
            "simulation": {
              "enabled": true
            }
          }
        },
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
    // 4. No Branch (Parent is Decision → parentNode matches node 2's id exactly)
    {
      "id": "node-task-draft-004",
      "type": "task",
      "parentNode": "node-decision-check-002",
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

1. **Root Node**: Entry point of the workflow. DO NOT specify \`parentNode\` for the root node.
   - GroupNodes must always have a parentNode — they cannot be root nodes
2. **Subsequent Nodes**: MUST specify \`parentNode\` (referencing an ID from your list).
3. **Fields**:
   - **task**: id, type="task", parentNode, position, data: { title, description, assignee, estimatedTime, metadata, execution, ports }
   - **service**: id, type="service", parentNode, position, data: { title, description, serviceType, http?, ports }
   - **decision**: id, type="decision", parentNode, position, data: { title, description, condition, mode, ports }
   - **group**: id, type="group", parentNode, position, data: { title, description, groups, ports }

⚠️ **branchLabel RULE (MANDATORY)**:
   - When a node's \`parentNode\` is a **Decision Node**, you MUST add \`"branchLabel": "yes"\` or \`"branchLabel": "no"\` to its \`data\` object.
   - This applies to ALL node types without exception: task, service, decision, group.
   - ❌ Wrong: child of decision node with no branchLabel field
   - ✅ Correct: \`"data": { "branchLabel": "yes", "title": "..." }\`

⛔ **parentNode INTEGRITY RULE (FATAL)**:
   - Before writing any \`parentNode\` value, verify that exact ID exists in your current node list.
   - ❌ NEVER invent or guess a parentNode ID — if you cannot find the parent node's ID in your list, you have a bug.
   - ✅ Strategy: Write nodes top-down. Assign an \`id\` first, then reference it as \`parentNode\` in children.
   - ❌ Wrong: node B has \`"parentNode": "node-task-abc"\` but no node with that exact id exists
   - ✅ Correct: node A has \`"id": "node-task-abc"\`, then node B has \`"parentNode": "node-task-abc"\`

DO NOT generate Start ("start") or End ("end") nodes.
DO NOT generate "edges".
`;

export const GENERATION_PROMPT_CONTENT = `
${CORE_NODE_TYPES}

${PARENT_CHILD_RULES}

${PRD_GENERATION_RULES}

${SERVICE_NODE_MOCK_DATA_RULES}

${GENERATION_RESPONSE_FORMAT}

${GENERATION_EXAMPLES}

${COMMON_VALIDATION_RULES}

${TECHNICAL_SPECIFICATION_RULES}
`;

export const GENERATION_SYSTEM_PROMPT = buildPrompt({
  operation: "generation",
  promptContent: GENERATION_PROMPT_CONTENT,
});

export function getGenerationContent(
  prompt: Parameters<GenerateWorkflowAction>[0],
  prdText?: Parameters<GenerateWorkflowAction>[1],
  nodeLibrary?: Parameters<GenerateWorkflowAction>[2],
): string {
  let content = `Create a workflow based on this request: "${prompt}"\n\n`;

  // Add PRD context if provided
  if (prdText) {
    content += `${buildPRDContext(prdText)}\n\n`;
    content += `IMPORTANT: Reference specific PRD sections in prdReference field for every node.\n\n`;
  }

  // Add available reusable nodes from library
  if (nodeLibrary && nodeLibrary.length > 0) {
    content += `═══════════════════════════════════════════════════════════════\n`;
    content += `AVAILABLE REUSABLE NODES FROM LIBRARY\n`;
    content += `═══════════════════════════════════════════════════════════════\n\n`;
    content += nodeLibrary
      .map(
        (node) =>
          `- ${node.name} (${node.category}, ${node.nodeType}): ${node.description}\n  Used ${node.usageCount} time(s)`,
      )
      .join("\n");
    content += `\n\nPrioritize reusing these nodes where applicable. When reusing, maintain the node structure but update prdReference to match current requirements.\n\n`;
  }

  content += `Remember: No Start/End nodes, No Edges. Use parentNode logic. Return your response as a JSON object.`;

  return content;
}
