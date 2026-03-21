import type { UpdateWorkflowActionParams, WorkflowNode } from "@/types";
import type { ValidationResult } from "@/types/ai/validators";
import { buildPrompt } from "./utils";
import {
  CORE_NODE_TYPES,
  FORBIDDEN_EMPTY_CONVERSION_RULES,
  PARENT_CHILD_RULES,
  COMMON_VALIDATION_RULES,
  TECHNICAL_SPECIFICATION_RULES,
} from "./common";

// const MODIFICATION_CONTEXT_RULES = `
// MODIFICATION CONTEXT:
// - You are provided with a specific **Selected Node** and its **Descendants**.
// - This is your "Effective Scope". You can modify, delete, or add children to these nodes.
// - You can also rewire existing nodes by updating their \`parentNode\`.

// ACTIONS:
// 1. **create**: Add new task/service/decision nodes.
//    - MUST specify \`parentNode\`.
//    - If parent is Decision, MUST specify \`branchLabel\` in the \`data\` object.
// 2. **update**: Modify data or \`parentNode\` of existing nodes.
// 3. **delete**: Remove nodes from the workflow.
// `;

const MODIFICATION_CONTEXT_RULES = `
MODIFICATION CONTEXT:
- You are provided with a list of editable node IDs (\`nodeIds\`) and a set of reference nodes (\`nodes\`).
- The nodes listed in \`nodeIds\` define your "Effective Scope".
- You may only modify, delete, or attach children to nodes within this scope.
- Nodes provided in \`nodes\` are reference context and must not be modified.

ACTIONS:
1. **create**: Add new task/service/decision nodes.
   - MUST specify \`parentNode\`.
   - The \`parentNode\` MUST be one of the nodes in \`nodeIds\`.
   - If parent is Decision, MUST specify \`branchLabel\` in the \`data\` object.
2. **update**: Modify data or \`parentNode\` of nodes within the Effective Scope.
   - The new \`parentNode\` MUST reference a node within \`nodeIds\`.
   - ⚠️ IMPORTANT: NEVER include \`functionCode: ""\` (empty string) in an update. If you don't need to change functionCode, OMIT the field entirely.
   - Only include fields you are actually changing. Omitted fields are preserved automatically.
3. **delete**: Remove nodes from the workflow, but only if they are within the Effective Scope.
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

---------------------------------------------------------------

Scenario: Fix a task node missing functionCode (FUNCTION_CODE_REQUIRED repair)

Response (Create with execution config + Update execution fields using FLAT format):
{
  "nodes": {
    "create": [
      {
        "id": "node-task-new-xyz",
        "type": "task",
        "parentNode": "parent-node-id",
        "position": { "x": 100, "y": 200 },
        "data": {
          "title": "Process Data",
          "description": "Filter and sort the input data",
          "assignee": "",
          "estimatedTime": 0,
          "metadata": {},
          "execution": {
            "config": {
              "functionCode": "return { items: Array.isArray(inputData?.items) ? inputData.items.filter(i => i.active) : [] };",
              "nodeData": {
                "inputData": { "items": [{"id":"1","active":true},{"id":"2","active":false},{"id":"3","active":true}] },
                "outputData": { "items": [{"id":"1","active":true},{"id":"3","active":true}] }
              }
            }
          },
          "ports": [
            {"id":"input","position":"top","type":"target"},
            {"id":"output","position":"bottom","type":"source"}
          ]
        }
      }
    ],
    "update": [
      {
        "id": "existing-task-id",
        "data": {
          "functionCode": "return { result: Array.isArray(inputData?.items) ? inputData.items.length : 0 };",
          "inputData": { "items": ["item1", "item2", "item3"] },
          "outputData": { "result": 3 }
        }
      }
    ],
    "delete": []
  },
  "metadata": { "description": "Fixed missing functionCode", "affectedNodeIds": ["existing-task-id"] }
}

CRITICAL: When updating execution fields, use FLAT format in data:
- "functionCode" → goes to execution.config.functionCode
- "inputData" → goes to execution.config.nodeData.inputData
- "outputData" → goes to execution.config.nodeData.outputData
NOT nested inside "execution": { "config": {...} }
`;

const MODIFICATION_EXECUTION_SCOPE_RULES = `
═══════════════════════════════════════════════════════════════
FUNCTIONCODE EXECUTION SCOPE (ABSOLUTE RULE)
═══════════════════════════════════════════════════════════════

When modifying or creating functionCode, remember these ABSOLUTE constraints:

**ONLY 2 VARIABLES ARE AVAILABLE:**
1. \`inputData\` - Data from parent node
2. \`fetch\` - Global fetch API

**THESE ARE FORBIDDEN (NOT IN SCOPE):**
- ❌ \`metadata\` (lives at node.data.metadata, not accessible in function)
- ❌ \`node\` (no access to node object)
- ❌ \`config\` (no access to execution config)
- ❌ \`this\` (no context binding)
- ❌ Any external/global variables except \`fetch\`

**FIXING CODE WITH EXTERNAL REFERENCES:**

If you see code like this:
\`\`\`javascript
// ❌ WRONG - metadata not in scope
const limit = metadata.maxTasks;
return { tasks: inputData.tasks.slice(0, limit) };
\`\`\`

Fix it by passing the value via inputData:
\`\`\`javascript
// ✅ CORRECT - all values from inputData
const limit = inputData.maxTasks;
return { tasks: inputData.tasks.slice(0, limit) };
\`\`\`

And update the inputData schema:
\`\`\`json
{
  "nodeData": {
    "inputData": {
      "tasks": [...],
      "maxTasks": 3  // ← Add the value here
    }
  }
}
\`\`\`

**RULE OF THUMB:**
- If you need a value in functionCode, it MUST come from \`inputData\`
- Store documentation/notes in \`metadata\`, but pass actual values via \`inputData\`
`;

const MODIFICATION_RESPONSE_FORMAT = `
RESPONSE FORMAT (JSON):
{
  "nodes": {
    "create": [ ...Array of new Nodes (task, service, decision, group) ],
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

${FORBIDDEN_EMPTY_CONVERSION_RULES}

${MODIFICATION_CONTEXT_RULES}

${PARENT_CHILD_RULES}

${MODIFICATION_EXECUTION_SCOPE_RULES}

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
  targetNodeIds,
  prompt,
  nodes,
}: UpdateWorkflowActionParams): string {
  // Basic context preparation logic handled by caller, just passing prompt
  // Ideally you would serialize the 'effective scope' here.
  return `
USER REQUEST: ${prompt}
SELECTED NODE ID's: ${JSON.stringify(targetNodeIds, null, 2)}
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
                parentNode: { type: ["string", "null"] },
                data: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    functionCode: { type: "string" },
                    inputData: { type: ["object", "null"] },
                    outputData: { type: ["object", "null"] },
                  },
                  additionalProperties: true,
                },
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
                data: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    functionCode: { type: "string" },
                    inputData: { type: ["object", "null"] },
                    outputData: { type: ["object", "null"] },
                  },
                  additionalProperties: true,
                },
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
    required: ["nodes", "metadata"],
    additionalProperties: false,
  };
}

// ============================================================================
// BATCH REPAIR PROMPT (used by 2-Phase validation pipeline)
// ============================================================================

export interface ViolationEntry {
  validatorName: string;
  result: ValidationResult;
}

function getFixGuidance(
  validatorName: string,
  result: ValidationResult,
): string {
  switch (result.errorType) {
    case "NO_ROOT_NODE":
      return "Make at least one node have no parentNode — update the node and set parentNode to null (JSON null, not the string 'null') to make it a root node";
    case "INVALID_PARENT_REFERENCES":
      return [
        "Fix parentNode for each affected node by choosing from the VALID NODE IDs list shown above in CURRENT CONTEXT.",
        "For each affected node:",
        "  (a) Find the most logical ancestor in VALID NODE IDs list → use its exact ID string as parentNode",
        "  (b) OR set parentNode to null (JSON null, NOT the string 'null') to make it a root node",
        "CRITICAL: Use ONLY IDs that appear in the VALID NODE IDs list. Do NOT invent new IDs.",
        "Prefer the nearest logical predecessor in the workflow tree (e.g., the task/group node that conceptually precedes this node).",
      ].join("\n");
    case "CIRCULAR_PARENTNODE_CYCLE":
      return "Break the parentNode cycle by removing parentNode from one of the cycle entry nodes — set parentNode to null (JSON null) or re-parent to a valid ancestor";
    case "CIRCULAR_REFERENCE_GROUPNODE":
      return "Remove the circular reference: GroupNode's parentNode must not point to a node inside its own groups[]. Extract the conflicting node to be standalone before the GroupNode";
    case "START_NODE_CHILD_INVALID_INPUT":
      return "Set execution.config.nodeData.inputData = null AND rewrite functionCode to NOT reference any inputData fields (initialize data from scratch instead)";
    case "ASYNC_TASK_NODES":
      return "Task/Decision nodes must be synchronous. Convert async task nodes to ServiceNodes (serviceType='api' with http config). Rewrite async decision nodes to use synchronous boolean logic only";
    case "INCOMPLETE_DECISION_NODES":
      return `Add missing branch nodes: Decision nodes need BOTH 'yes' AND 'no' branch children (each with branchLabel set). Fix any decision children with missing or invalid branchLabel. (incomplete: ${result.metadata?.incompleteCount ?? 0}, orphaned: ${result.metadata?.orphanedCount ?? 0})`;
    case "BROKEN_GROUPNODE_PIPELINES":
      return [
        "⛔ OUTPUT_BOUNDARY FIX — read FIRST for output_boundary errors:",
        "  output_boundary means: GroupNode.outputData ≠ lastChild.outputData",
        "  The ISSUE message says: 'output_boundary: group=[\"tasks\"], child \"X\" has [\"success\",\"taskId\"]'",
        "  FIX: Set GroupNode.outputData = EXACT COPY of lastChild.outputData (REPLACE, do NOT merge/add)",
        "  STEP 1: Read lastChild.nodeData.outputData from EXISTING NODES",
        "  STEP 2: Set GroupNode.nodeData.outputData = IDENTICAL copy (same keys + sample values)",
        "  STEP 3: Update GroupNode.functionCode to return the same structure",
        "  ❌ WRONG: GroupNode.outputData adds old keys — { tasks:[...], success:true }",
        "  ✅ CORRECT: GroupNode.outputData = lastChild's outputData exactly — { success:true, taskId:'t1' }",
        "  In nodes.update: { id: 'group-id', data: { outputData: {copy of lastChild.outputData}, functionCode: 'return { ...lastChild result shape }' } }",
        "",
        "⛔ GROUPNODE NESTING CHECK — read FIRST before attempting a fix:",
        "  If ISSUE contains '⚠️ NESTING DETECTED' (for EITHER prevNode OR nextNode type=group),",
        "  the structure is fundamentally wrong — a feature GroupNode is nested inside another GroupNode.",
        "  Feature-level GroupNodes MUST be SIBLINGS — NEVER inside another GroupNode's pipeline.",
        "",
        "  The ISSUE message will state the exact fix, e.g.:",
        "  '⚠️ NESTING DETECTED: prevNode \"Task List\"[type=group] ... REQUIRED FIX: update \"Task List\".parentNode from \"node-group-display-date-XXX\" to \"node-task-daily-focus-XXX\"'",
        "  → Apply EXACTLY that fix: use the parentNode value stated in the message (it is already in your nodeIds scope).",
        "",
        "  REPARENTING FORMULA (apply for EACH nested GroupNode):",
        "    nested GroupNode's new parentNode = nested GroupNode's CURRENT parent GroupNode's own parentNode",
        "  EXAMPLE:",
        "    CURRENT: 'Display Date'(parentNode=root-task) → 'Task List'(parentNode=Display Date) ← WRONG",
        "    FIX:     'Task List'.parentNode = 'Display Date'.parentNode = root-task-id",
        "    RESULT:  'Display Date'(parentNode=root-task) and 'Task List'(parentNode=root-task) ← SIBLINGS ✅",
        "  Repeat for ALL nested GroupNodes (e.g., if 'Energy Score' is inside 'Task List', also reparent it to root).",
        "  The root task ID is in your nodeIds scope — use it directly.",
        "  In nodes.update: { id: 'nested-group-id', parentNode: 'root-task-id' }",
        "  Do NOT try to fix key mismatches — reparenting resolves the root cause.",
        "",
        "BOUNDARY VIOLATION FIX (for input_boundary / output_boundary errors):",
        "  input_boundary: GroupNode.inputData is AUTHORITATIVE (it was set from parent's outputData).",
        "    → Update firstChild.inputData to EXACTLY match GroupNode.inputData (same keys + values)",
        "    → Update firstChild.functionCode to USE the GroupNode.inputData fields",
        "    → DO NOT change GroupNode.inputData — it is already correct",
        "    ⚠️ CRUD GROUP SPECIAL CASE — when GroupNode.inputData = { tasks: [...] } and firstChild does CRUD:",
        "       The firstChild's purpose is Add/Edit/Delete/Complete an item from the tasks list.",
        "       Its functionCode MUST derive operation fields FROM inputData.tasks — NOT from non-existent keys.",
        "       ❌ WRONG: functionCode reads inputData.newTaskContent (field doesn't exist in {tasks})",
        "       ✅ CORRECT examples:",
        "         Add:    return { content: 'New Task', date: '2026-01-04' }; (hardcoded new item — no inputData read needed)",
        "         Edit:   return { taskId: inputData.tasks[0].id, content: 'Updated Task' }; (read id from array)",
        "         Delete: return { taskId: inputData.tasks[0].id }; (read id from array)",
        "         Complete: return { taskId: inputData.tasks[0].id, completed: true }; (read id from array)",
        "       Set firstChild.outputData to match what its functionCode returns (not the tasks array).",
        "  output_boundary: lastChild.outputData is AUTHORITATIVE.",
        "    → Update GroupNode.outputData to EXACTLY match lastChild.outputData",
        "CHAINING CONTRACT (enforce on ALL broken pairs listed in ISSUE):",
        "  • node[i].nodeData.inputData keys MUST EXACTLY MATCH node[i-1].nodeData.outputData keys",
        "  • node[i].functionCode MUST only read fields present in node[i].nodeData.inputData",
        "  • node[i].functionCode return value shape MUST match node[i].nodeData.outputData",
        "  • (input_boundary) firstChild.inputData keys MUST match GroupNode.inputData keys",
        "  • (output_boundary) lastChild.outputData keys MUST match GroupNode.outputData keys",
        "FIX PROCEDURE — apply to EACH broken pair:",
        "STEP 1: Identify missing keys (listed in ISSUE as 'missing keys (nextNode needs but prevNode doesn't output)')",
        "STEP 2: Check 'prevNode available input keys (can pass through)' (listed in ISSUE)",
        "STEP 3: Choose repair strategy based on what is available:",
        "",
        "STRATEGY A — PASS-THROUGH (PREFERRED):",
        "  When ALL missing keys are present in 'prevNode available input keys':",
        "  → Extend prevNode to pass through those keys — do NOT change nextNode.inputData:",
        "    - Add missing keys to prevNode.nodeData.outputData",
        "    - Update prevNode.functionCode to return { ...ownResult, missingKey1: inputData.missingKey1, ... }",
        "    - Do NOT change nextNode.inputData or nextNode.functionCode (they are semantically correct)",
        "  This is valid because prevNode.inputData is itself already a subset of its parent's outputData,",
        "  so any key in prevNode.inputData can safely be forwarded to nextNode.",
        "",
        "STRATEGY B — ADAPT NEXT (fallback only when nextNode is NOT a service node):",
        "  When missing keys are NOT in prevNode's available input keys AND nextNode is a TASK (not service):",
        "  → Adapt nextNode to work with what prevNode actually outputs:",
        "    - Update nextNode.nodeData.inputData to match prevNode's actual return shape",
        "    - Rewrite nextNode.functionCode to read from the corrected inputData keys",
        "    - Update nextNode.nodeData.outputData to reflect what the new functionCode returns",
        "",
        "STRATEGY C — REDESIGN PREV (when nextNode is a SERVICE and missing keys can't pass through):",
        "  When prevNode is a TASK and nextNode is a SERVICE with missing inputData keys:",
        "  The task's purpose should be to PREPARE the API call payload — NOT to accumulate local arrays.",
        "  → Redesign prevNode to output exactly what the service needs:",
        "    - Update prevNode.nodeData.outputData keys to match nextNode.nodeData.inputData keys",
        "    - Rewrite prevNode.functionCode to extract/prepare those fields from its own inputData",
        "    - DO NOT change nextNode.inputData (it is semantically correct for the API call)",
        "  EXAMPLE:",
        "    WRONG: prevNode 'Mark Task' outputs {updatedTasks:[...]} → service needs {taskId}",
        "    FIX:   prevNode functionCode: 'return { taskId: inputData.tasks[0].id, completed: true };'",
        "           prevNode.outputData = { taskId: \"task-1\", completed: true } (matches service inputData)",
        "  ⚠️ AFTER STRATEGY C — MANDATORY BOUNDARY SYNC:",
        "    prevNode is the last child → GroupNode.outputData MUST be updated to match prevNode's NEW outputData.",
        "    In the SAME response: update GroupNode.outputData = prevNode's new outputData.",
        "    ❌ Skipping GroupNode update will cause an output_boundary violation in the next check.",
        "",
        "PREFER STRATEGY A/C over B — A and C preserve nextNode's semantic purpose (e.g., a service node calling",
        "PUT /api/tasks/:taskId must keep taskId in its inputData; change prevNode instead).",
        "NEVER change inputData without also updating functionCode. Fix both together.",
        "BOUNDARY SYNC (MANDATORY after every chain fix):",
        "  - If firstChild.inputData changed → update GroupNode.execution.config.nodeData.inputData to SAME keys",
        "  - If lastChild.outputData changed → update GroupNode.execution.config.nodeData.outputData to SAME keys",
        "  Both the chain node AND the GroupNode must be updated in the SAME response.",
        "OUTER CONTRACT (MANDATORY — prevents Parent-Child Data Flow violations):",
        "  After syncing GroupNode boundaries, check the GroupNode's own parent node:",
        "  - If GroupNode.inputData changed → GroupNode's parent outputData must also change to match",
        "    Update the parent node's outputData AND functionCode to return the new GroupNode.inputData keys",
        "  - If GroupNode.outputData changed → GroupNode's children (downstream) must also be updated",
        "  Fix the ENTIRE chain: parent → GroupNode → firstChild in ONE response.",
      ].join("\n");
    case "GROUP_NODE_MIN_CHILDREN":
      return [
        "GroupNode must contain at least 2 child nodes (Task/Service/Decision).",
        "",
        "⚠️ FIX ALL GROUPS IN THIS SINGLE RESPONSE — see the MIN CHILDREN DEFICIT table above for exact counts.",
        "   The deficit table tells you EXACTLY how many nodes to create per group. Create them ALL now.",
        "",
        "⚠️ CHECK FOR ORPHANED NODES FIRST (most common cause):",
        "  Before creating new nodes, check the VALID NODE IDs list above for nodes that are ORPHANED",
        "  (nodes whose parentNode references a non-existent ID — see Parent Node Structure violation if co-occurring).",
        "  Those orphaned nodes are VERY LIKELY the intended children of this empty GroupNode — just fix their parentNode.",
        "  ✅ PREFERRED FIX: Update orphaned nodes' parentNode to this GroupNode's exact ID.",
        "  ❌ DO NOT create new child nodes if orphaned nodes already exist with the right semantic purpose.",
        "",
        "OPTION A (if no orphaned nodes exist): Add meaningful child nodes via nodes.create",
        "  - ⚠️ CRITICAL: Use FRESH IDs that do NOT appear in the EXISTING NODES list above.",
        "    IDs that already exist will be silently SKIPPED — the create will have NO effect.",
        "    ✅ DO: generate a completely new ID like 'p2-node-task-display-result-NEW-001'",
        "    ❌ DO NOT: reuse the ID of an existing node (e.g., the existing service node's ID)",
        "  - For groups with 0 children: create BOTH a TaskNode(prepare) AND a ServiceNode(action)",
        "  - For groups with 1 child: create 1 more node that chains from the existing child's outputData",
        "  - Both must have functionCode and matching inputData/outputData",
        "  - Set parentNode to the GroupNode's exact ID",
        "  - ⚠️ PIPELINE CHAIN RULE: If the GroupNode already has existing children,",
        "    the new node MUST chain from the last existing child — NOT from the GroupNode's inputData.",
        "    new_node.inputData MUST EXACTLY MATCH last_existing_child.outputData.",
        "    ❌ WRONG: GroupNode.inputData={tasks:[...]}, last child outputs {displayedTasks:[...]},",
        "              new node has inputData={tasks:[...]} — BREAKS pipeline (needs {displayedTasks})",
        "    ✅ CORRECT: new node has inputData={displayedTasks:[...]} matching last child's output",
        "    The new node should perform a DIFFERENT operation from existing children",
        "    (e.g., if existing child displays tasks, new child could filter/count/summarize them)",
        "OPTION B (if GroupNode has no semantic purpose): Remove the GroupNode",
        "  - Delete the GroupNode and make its children standalone (update their parentNode to GroupNode's parent)",
        "NEVER leave a GroupNode with only 0 or 1 child.",
      ].join("\n");
    case "INVALID_ROOT_GROUPNODES":
      return "GroupNodes cannot be root nodes. Insert a Task node before each root GroupNode to initialize its input data — the Task becomes the root and the GroupNode becomes its child";
    case "FUNCTION_CODE_INPUTDATA_MISMATCH":
      return [
        "FIX RULE: functionCode must only reference fields that exist in inputData.",
        "",
        "TWO OPTIONS — choose based on whether inputData is authoritative:",
        "  OPTION A (inputData is authoritative — node is inside a GroupNode):",
        "    → REWRITE functionCode to only use the fields that ARE in inputData.",
        "    → DO NOT add fields to inputData that don't exist there — inputData is set by the pipeline.",
        "    ⚠️ CRUD TASK PATTERN — if inputData={tasks:[...]} but functionCode uses inputData.taskId, inputData.content, etc.:",
        "       Those fields DON'T exist in {tasks:[...]}. DO NOT add taskId/content to inputData.",
        "       Instead, derive them FROM the array:",
        "         - taskId:  use inputData.tasks[0].id",
        "         - content: use inputData.tasks[0].content OR hardcode 'Updated Task'",
        "         - new item: hardcode it — { content: 'New Task', date: '2026-01-04' }",
        "       ✅ Rewrite functionCode: return { taskId: inputData.tasks[0].id, content: 'Updated Task' };",
        "",
        "  OPTION B (functionCode is authoritative — root node or standalone node):",
        "    → Add the missing fields to inputData so functionCode can reference them.",
        "    → Match the value type that functionCode expects.",
      ].join("\n");
    case "OUTPUT_DATA_TYPE_MISMATCH":
      return [
        "PROBLEM: functionCode's actual return value shape does not match declared nodeData.outputData.",
        "FIX: Update nodeData.outputData to match what functionCode actually returns.",
        "  → Run functionCode mentally with the given inputData to see what it returns.",
        "  → Set outputData keys and value types to match the return value.",
        "  → DO NOT change functionCode to match outputData — outputData is the schema, functionCode is the logic.",
        "  → If functionCode returns extra passthrough keys (e.g., tasks: inputData.tasks), ADD them to outputData.",
        "     Do NOT strip passthrough keys from functionCode — they may be required by downstream nodes.",
      ].join("\n");
    case "SERVICE_NODE_FUNCTION_CODE_MISSING":
    case "SERVICE_NODE_FUNCTION_CODE":
      return [
        "CRITICAL PATH ERROR: functionCode MUST be inside execution.config — NOT at the top level of data.",
        "❌ WRONG: { data: { functionCode: '...', execution: { config: { nodeData: {...} } } } }",
        "✅ CORRECT: { data: { execution: { config: { functionCode: '...', nodeData: {...} } } } }",
        "Ensure functionCode uses fetch() to call the configured http endpoint and returns the response data.",
      ].join("\n");
    case "SERVICE_NODE_SIMULATION_MISSING":
    case "SERVICE_NODE_SIMULATION":
      return "Fix ServiceNode simulation data to be consistent with the node's inputData/outputData schemas";
    case "SERVICE_NODE_RUNTIME_TYPE_MISMATCH":
    case "SERVICE_NODE_RUNTIME":
      return [
        "SERVICE NODE RUNTIME FAILURE — the service node's functionCode execution or return type is wrong.",
        "",
        "⚠️ IMPORTANT: functionCode for service nodes is AUTO-GENERATED from data.http — do NOT change functionCode directly.",
        "The pipeline will overwrite any functionCode you write with the auto-generated version from data.http.",
        "",
        "FIX RULE: Update nodeData.outputData to match what response.json() actually returns.",
        "  The auto-generated code does: return await response.json()",
        "  The mock fetch returns nodeData.outputData as JSON.",
        "  So: result = nodeData.outputData — the keys must match.",
        "",
        "MOST COMMON ISSUES:",
        "1. outputData is null — set it to a realistic object matching what the API returns",
        "   ✅ FIX: { \"outputData\": { \"tasks\": [{\"id\":\"t1\",\"content\":\"Buy milk\",\"completed\":false},{\"id\":\"t2\",\"content\":\"Write report\",\"completed\":true},{\"id\":\"t3\",\"content\":\"Exercise\",\"completed\":false}] } }",
        "2. outputData keys don't match what the real API would return — use realistic mock data",
        "3. If the service node has non-null inputData and the body needs inputData fields:",
        "   → Update data.http.body to include the required fields using template syntax: { \"taskId\": \"{{inputData.taskId}}\" }",
        "   → Then update nodeData.inputData to include those fields: { \"taskId\": \"abc-123\" }",
        "   → And ensure nodeData.outputData matches what the API returns",
        "",
        "UPDATE FORMAT (FLAT): { \"id\": \"svc-node-id\", \"data\": { \"outputData\": {...} } }",
        "DO NOT include functionCode in the update — it is auto-generated.",
      ].join("\n");
    case "PARENT_CHILD_DATA_FLOW":
      return [
        "⚠️ READ THE HINT IN THE ISSUE MESSAGE — it tells you exactly what to do:",
        "  If the message says '[FIX HINT: ...]' → the child GroupNode is correctly positioned.",
        "    → Update its inputData to match the parent's outputData keys (do NOT reparent).",
        "    → ALSO update first child of the GroupNode (groups[0]) inputData to match.",
        "    In nodes.update: { id: 'group-id', data: { inputData: {copy of parent.outputData} } }",
        "    AND:             { id: 'first-child-id', data: { inputData: {copy of parent.outputData} } }",
        "  If the message says '[REPARENTING HINT: ...]' → the GroupNode is a feature chained incorrectly.",
        "    → Move the GroupNode UP one level by reparenting it (use parentNode stated in hint).",
        "",
        "⚠️ SEQUENTIAL CHAIN FIX (when REPARENTING is needed):",
        "  If the broken pair is: task node → GroupNode (e.g., 'Add New Task'→'Edit Task' group),",
        "  the GroupNode is likely a SIBLING FEATURE that was incorrectly chained as a child.",
        "  Features are INDEPENDENT — they all receive data from the SAME root parent, not from each other.",
        "  FIX: Move the GroupNode UP one level by reparenting it:",
        "    - Find what parentNode the task node has (its parent = the root task or shared ancestor)",
        "    - Change GroupNode.parentNode to THAT SAME parent ID",
        "    - This makes the GroupNode a SIBLING of the task node, not its child",
        "  EXAMPLE:",
        "    WRONG: Root→AddNewTask(task)→EditTask(group)  ← chain, keys mismatch",
        "    CORRECT: Root→AddNewTask(task), Root→EditTask(group)  ← siblings, both get {tasks} from Root",
        "  In nodes.update: set { id: 'group-edit-task-id', parentNode: 'root-task-id' }",
        "  Use the VALID NODE IDs list to find the correct root task ID.",
        "",
        "TYPE SEMANTICS — null ≠ {} ≠ undefined (strictly different):",
        "  • null inputData   = 'self-initializing: expects NO data from parent'",
        "  • {} inputData     = 'receives an empty object from parent'",
        "  • {key:...}        = 'receives specific fields from parent'",
        "FIX RULE — match child.inputData TYPE to parent.outputData exactly:",
        "  • parent.outputData === null/undefined → child.inputData = null",
        "  • parent.outputData === {}             → child.inputData = {} (NOT null)",
        "  • parent.outputData === {key:val}      → child.inputData must include those keys",
        "ALWAYS update child.functionCode when inputData changes.",
        "NEVER substitute null with {} just to 'fill in' a value — they are semantically different.",
        "GROUPNODE CHILD SPECIAL RULE:",
        "  If the child is a GroupNode, updating GroupNode.inputData is NOT enough:",
        "  → Also update GroupNode's firstChild.inputData to match the new GroupNode.inputData",
        "  → Also update GroupNode's firstChild.functionCode to use the new keys",
        "  Fix parent → GroupNode → firstChild all in ONE response.",
      ].join("\n");
    case "TASK_NODE_IGNORES_INPUTDATA":
      return [
        "Decision node has non-null inputData but functionCode never references it.",
        "Decision nodes MUST derive their boolean return value from inputData condition.",
        "FIX: Rewrite functionCode to evaluate a condition on inputData fields and return true/false:",
        "  1. Identify the relevant field in inputData (e.g., inputData.status, inputData.approved)",
        "  2. Write a boolean expression: return inputData.fieldName === expectedValue",
        "  3. Ensure outputData: true (boolean sample)",
        "❌ BANNED: return true; (with non-null inputData — hardcoded, ignores inputData)",
      ].join("\n");
    case "FUNCTION_CODE_REQUIRED":
      return [
        "⛔ CRITICAL — USE 'update' NOT 'create':",
        "  The AFFECTED NODE IDs are listed above. You MUST add functionCode by UPDATING those exact IDs.",
        "  Do NOT create new nodes with different IDs — this causes duplicate nodes and pipeline breakage.",
        "  ❌ WRONG: nodes.create = [{ \"id\": \"node-task-prepare-task-data-001\", ... }]  ← new ID, causes duplicate",
        "  ✅ CORRECT: nodes.update = [{ \"id\": \"node-task-cd10f3e3-5e18-47f9-8e03-a44dd4c32dfc\", \"data\": { \"functionCode\": \"...\" } }]  ← exact same ID",
        "",
        "FIRST: Check if functionCode is misplaced inside nodeData:",
        "  ❌ Wrong: config.nodeData.functionCode → ✅ Correct: config.functionCode",
        "  If found in wrong location, MOVE it to the correct location.",
        "",
        "UPDATE FORMAT — use the FLAT format (NOT nested execution.config):",
        "  ✅ CORRECT update format:",
        "  { \"id\": \"<exact-affected-node-id>\", \"data\": { \"functionCode\": \"return { result: ... };\", \"inputData\": {...}, \"outputData\": {...} } }",
        "  ❌ WRONG (nested format for updates — will NOT be applied):",
        "  { \"id\": \"...\", \"data\": { \"execution\": { \"config\": { \"functionCode\": \"...\" } } } }",
        "",
        "For each affected task node, choose ONE of:",
        "1. WRITE meaningful functionCode that genuinely transforms inputData → outputData (use UPDATE with the exact existing ID)",
        "2. DELETE the node if it has no real computational purpose",
        "",
        "WHEN TO DELETE:",
        "  - inputData and outputData have the same structure (same keys, same sample values) → DELETE (trivial passthrough)",
        "  - You cannot write logic that meaningfully transforms input to output → DELETE",
        "",
        "WHEN TO FIX — TEMPLATE:",
        "  - Data-processing node: \"return { processedKey: Array.isArray(inputData?.items) ? inputData.items.filter(x => x.active) : inputData?.items ?? [] };\"",
        "  - Trigger-style (inputData: null): \"return { tasks: [{id:'task-1',content:'Buy milk',completed:false,date:'2026-01-01'},{id:'task-2',content:'Read book',completed:true,date:'2026-01-01'},{id:'task-3',content:'Exercise',completed:false,date:'2026-01-01'}] };\"",
        "  - Action-style (outputData: null): \"doSomething(inputData?.id); return undefined;\"",
        "  - User input capture node (new field not in inputData): \"return { ...inputData, energyScore: 5 };\" (hardcoded sample — the new field IS the output)",
        "",
        "⚠️ DATA INTEGRITY: functionCode MUST ONLY reference fields that EXIST in inputData.",
        "  If the node needs field X but X is not in inputData:",
        "  → EITHER: add X to inputData with a sample value AND reference inputData.X",
        "  → OR: hardcode X as output (user input capture pattern) — do NOT read it from inputData",
        "  ❌ WRONG: inputData={tasks:[...]}, functionCode: 'return { isValid: inputData.energyScore >= 0 };'",
        "  ✅ FIX: inputData={tasks:[...],energyScore:5}, functionCode: 'const isValid = inputData.energyScore >= 0; return { isValid };'",
        "",
        "⚠️ DO NOT add 'return inputData;' — this is a trivial passthrough → DELETE instead.",
        "⚠️ Service/decision nodes have functionCode AUTO-GENERATED — do NOT add functionCode to them.",
      ].join("\n");
    case "EMPTY_DATA_SHAPE":
      return [
        "inputData or outputData contains an empty object ({}) or under-populated array (fewer than 3 elements).",
        "The validator requires EXACTLY 3 or more elements in every array — 1 or 2 elements ALSO fail.",
        "Empty shapes cannot be type-inferred. Fix ALL of the following:",
        "",
        "BANNED PATTERNS — these are still violations even after your fix:",
        "  ❌ {}                        — empty object",
        "  ❌ []                        — empty array (0 elements)",
        "  ❌ [x]                       — array with 1 element (STILL fails — need 3+)",
        "  ❌ [x, y]                    — array with 2 elements (STILL fails — need 3+)",
        "  ❌ [{}]                      — array of empty objects",
        "  ❌ { tasks: [] }             — object with empty array value",
        "  ❌ { tasks: [{...}] }        — object with 1-element array (STILL fails — need 3+)",
        "  ❌ { tasks: [{...},{...}] }  — object with 2-element array (STILL fails — need 3+)",
        "",
        "⛔ CRITICAL — USE 'update' NOT 'create':",
        "  The AFFECTED NODE IDs are listed above. Update those exact IDs.",
        "  Do NOT create new nodes with different IDs — this causes duplicates.",
        "",
        "(1) Empty object {}: use null if node produces no output, OR add at least 1 real key-value pair.",
        "(2) Any array with fewer than 3 elements: add representative examples until you have 3+.",
        "    For inputData[key] that's [] or has < 3 elements:",
        "      Check the PARENT NODE CONTEXT above — copy parent.outputData[key] structure if it exists",
        "      If parent doesn't have that key AND functionCode doesn't reference inputData.key → remove the key entirely",
        "    For outputData[key] that's [] or has < 3 elements:",
        "      Look at functionCode — copy the inputData field that this key is derived from",
        "      If 'return { key: inputData.otherKey }', then outputData[key] should mirror inputData[otherKey]",
        "    EXAMPLE for a Task-type app:",
        "      ❌ inputData: { tasks: [] }",
        "      ❌ inputData: { tasks: [{id:'task-1',content:'Buy milk',completed:false,date:'2026-01-01'}] }  ← 1 element, STILL fails",
        "      ✅ inputData: { tasks: [{id:'task-1',content:'Buy milk',completed:false,date:'2026-01-01'},{id:'task-2',content:'Write report',completed:true,date:'2026-01-01'},{id:'task-3',content:'Exercise',completed:false,date:'2026-01-01'}] }",
        "    For service nodes with GET method that DON'T filter by inputData fields:",
        "      ✅ inputData: null  (trigger-style — no input consumed)",
        "    SPECIAL CASE — filter/delete nodes (outputData shrinks from inputData):",
        "      When functionCode uses .filter() or removes items by ID:",
        "      inputData array MUST have 4+ elements so outputData after removal still has 3+",
        "      ❌ WRONG: inputData.tasks=[t1,t2,t3] → filter removes 1 → outputData.tasks=[t2,t3] (2 elements, FAILS)",
        "      ✅ CORRECT: inputData.tasks=[t1,t2,t3,t4] → filter removes 1 → outputData.tasks=[t2,t3,t4] (3 elements, passes)",
        "(3) Apply recursively — nested objects and arrays must ALSO be non-empty.",
        "(4) After filling shapes, ensure chaining keys still match adjacent nodes.",
        "",
        "UPDATE FORMAT reminder: use flat format { \"inputData\": {...}, \"outputData\": {...} } — NOT nested execution.config.",
      ].join("\n");
    case "DECISION_NODE_OUTPUT_FORMAT":
      return [
        "Decision node functionCode MUST return a plain boolean (true or false), NOT an object.",
        "FIX: Remove any object spreading and return a pure boolean expression.",
        "❌ WRONG: return { ...inputData, success: inputData.status === 'active' }",
        "❌ WRONG: return { result: 'approved' }",
        "✅ CORRECT: return inputData.status === 'active'",
        "✅ CORRECT: return Boolean(inputData.token)",
        "Also FIX nodeData.outputData: set to true (boolean sample, not an object).",
        "The executor passes the decision node's inputData directly to the chosen child — no need to spread.",
      ].join("\n");
    default:
      return `Fix the reported validation error (validator: ${validatorName}, type: ${result.errorType ?? "unknown"})`;
  }
}

function stripUIFields(data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};
  const {
    state: _state,
    ports: _ports,
    testCases: _tests,
    branchLabel: _branch,
    icon: _icon,
    ...rest
  } = data;
  return rest;
}

function extractNodeExecutionContext(node: WorkflowNode) {
  const relevantData = stripUIFields(node.data as Record<string, unknown>);

  if (Array.isArray(relevantData.groups)) {
    relevantData.groups = (
      relevantData.groups as Array<{
        data: Record<string, unknown>;
        [key: string]: unknown;
      }>
    ).map((child) => ({
      ...child,
      data: stripUIFields(child.data as Record<string, unknown>),
    }));
  }

  return {
    id: node.id,
    type: node.type,
    parentNode: node.parentNode,
    data: relevantData,
  };
}

/**
 * Extract minimal parent-node context (id, type, title, outputData) for a given node.
 * Used to provide cross-node context in repair prompts so AI can infer missing inputData values.
 */
function extractParentContext(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
): { parentId: string; parentType: string; parentTitle: string; parentOutputData: unknown } | null {
  if (!node.parentNode) return null;
  const parent = allNodes.find((n) => n.id === node.parentNode);
  if (!parent) return null;
  const parentData = parent.data as Record<string, unknown>;
  const execution = parentData.execution as { config?: { nodeData?: { outputData?: unknown } } } | undefined;
  return {
    parentId: parent.id,
    parentType: parent.type ?? "unknown",
    parentTitle: (parentData.title as string) ?? "(no title)",
    parentOutputData: execution?.config?.nodeData?.outputData ?? null,
  };
}

/**
 * Build a single batch repair prompt for multiple validation violations.
 * Used by the 2-Phase validation pipeline to reduce AI call count.
 *
 * @param violations - Violations to repair
 * @param allNodes   - Full node list (optional). When provided, parent-node outputData context
 *                     is injected for EMPTY_DATA_SHAPE and PARENT_CHILD_DATA_FLOW violations
 *                     so the AI can cross-reference without guessing.
 */
export function buildBatchRepairPrompt(
  violations: ViolationEntry[],
  allNodes?: WorkflowNode[],
): string {
  const violationNames = new Set(violations.map((v) => v.validatorName));
  const hasGroupPipeline = violationNames.has("GroupNode Pipelines");
  const hasParentChild = violationNames.has("Parent-Child Data Flow");
  const hasEmptyShape = violationNames.has("Empty Data Shape");
  const hasMinChildren = violationNames.has("GroupNode Min Children");
  const hasParentNodeStructure = violationNames.has("Parent Node Structure");

  // Build cross-violation note
  let crossViolationNote = "";
  if (hasGroupPipeline && hasParentChild) {
    // Check if Parent-Child Data Flow has REPARENTING HINT (mispositioned group) or FIX HINT (wrong inputData)
    const parentChildViolation = violations.find(v => v.validatorName === "Parent-Child Data Flow");
    const pcMsg = parentChildViolation?.result.errorMessage ?? "";
    const hasReparentingHint = pcMsg.includes("REPARENTING HINT");
    const hasFIXHint = pcMsg.includes("FIX HINT");
    if (hasReparentingHint) {
      crossViolationNote =
        "\n⚠️ MULTI-VALIDATOR DEPENDENCY: GroupNode Pipelines and Parent-Child Data Flow violations coexist.\n" +
        "   LIKELY CAUSE: Features are chained sequentially instead of being siblings under the root task.\n" +
        "   FIX FIRST: Reparent the GroupNode(s) flagged with [REPARENTING HINT] to the correct parentNode.\n" +
        "   THEN: Fix GroupNode pipeline chaining and boundary contracts.\n";
    } else if (hasFIXHint) {
      crossViolationNote =
        "\n⚠️ MULTI-VALIDATOR DEPENDENCY: GroupNode Pipelines and Parent-Child Data Flow violations coexist.\n" +
        "   Parent-Child Data Flow violations have [FIX HINT] — these GroupNodes are correctly positioned.\n" +
        "   FIX: Update each GroupNode's inputData to EXACTLY match its parent's outputData (as stated in FIX HINT).\n" +
        "   ALSO update firstChild.inputData to match the GroupNode's updated inputData.\n" +
        "   THEN: Fix GroupNode pipeline violations (Strategy A: extend prevNode to pass through missing keys).\n" +
        "   DO NOT reparent — the GroupNodes are already in the correct place.\n";
    } else {
      crossViolationNote =
        "\n⚠️ MULTI-VALIDATOR DEPENDENCY: GroupNode Pipelines and Parent-Child Data Flow violations coexist.\n" +
        "   Read each violation's hint carefully — some need reparenting, others need inputData updates.\n";
    }
    if (hasEmptyShape) {
      crossViolationNote += "   Also fix Empty Data Shape — fill arrays to 3+ elements with realistic data.\n";
    }
  } else if (hasParentChild && !hasGroupPipeline) {
    const parentChildViolation = violations.find(v => v.validatorName === "Parent-Child Data Flow");
    const pcMsg = parentChildViolation?.result.errorMessage ?? "";
    if (pcMsg.includes("FIX HINT")) {
      crossViolationNote =
        "\n⚠️ PARENT-CHILD DATA FLOW: Violations have [FIX HINT] — GroupNodes are correctly positioned.\n" +
        "   FIX: Update each GroupNode's inputData to EXACTLY match parent's outputData keys (as stated in hint).\n" +
        "   ALSO update firstChild.inputData to match.\n" +
        "   DO NOT reparent.\n";
    } else {
      crossViolationNote =
        "\n⚠️ PARENT-CHILD DATA FLOW: Check if any broken pair is task→GroupNode with mismatched keys.\n" +
        "   If the violation has [REPARENTING HINT]: reparent the GroupNode UP one level.\n" +
        "   If the violation has [FIX HINT]: update the GroupNode's inputData to match parent's outputData.\n";
    }
  } else if (hasEmptyShape && (hasGroupPipeline || hasParentChild)) {
    crossViolationNote =
      "\n⚠️ MULTI-VALIDATOR DEPENDENCY: Empty Data Shape and data-flow violations coexist.\n" +
      "   Fix empty shapes CONSISTENTLY with the chaining contract — the filled-in keys must satisfy adjacent node requirements.\n";
  }
  if (hasMinChildren && hasParentNodeStructure) {
    crossViolationNote +=
      "\n⚠️ MULTI-VALIDATOR DEPENDENCY: GroupNode Min Children and Parent Node Structure violations coexist.\n" +
      "   These are almost certainly the SAME problem: the orphaned nodes (invalid parentNode) ARE the missing children.\n" +
      "   DO NOT create new child nodes. Instead:\n" +
      "   STEP 1: Look at 'Parent Node Structure' affected nodes (nodes with invalid parentNode).\n" +
      "   STEP 2: Look at 'GroupNode Min Children' affected nodes (empty GroupNodes).\n" +
      "   STEP 3: For each orphaned node, set its parentNode to the correct GroupNode ID from the VALID NODE IDs list.\n" +
      "   The orphaned nodes and the empty GroupNodes are likely meant to be parent-child pairs.\n" +
      "   Fix BOTH violations with a single set of parentNode updates.\n";
  }
  if (hasMinChildren && hasGroupPipeline) {
    // Only show this note when the MinChildren GroupNode is also pipeline-broken
    const minChildrenIds = new Set(
      violations.find(v => v.validatorName === "GroupNode Min Children")
        ?.result.affectedNodes?.map(n => n.id) ?? []
    );
    const pipelineIds = new Set(
      violations.find(v => v.validatorName === "GroupNode Pipelines")
        ?.result.affectedNodes?.map(n => n.id) ?? []
    );
    const sameGroupBroken = [...minChildrenIds].some(id => pipelineIds.has(id));
    if (sameGroupBroken) {
      crossViolationNote +=
        "\n⚠️ MULTI-VALIDATOR DEPENDENCY: The SAME GroupNode has both Min Children and pipeline violations.\n" +
        "   The pipeline mismatch is CAUSED BY a newly created 2nd child having wrong inputData.\n" +
        "   The new child node's inputData MUST match the last existing child's outputData — NOT the GroupNode's inputData.\n" +
        "   STEP 1: Find the GroupNode that has only 1 existing child.\n" +
        "   STEP 2: Read the existing child's outputData (e.g., {displayedTasks:[...]}).\n" +
        "   STEP 3: Set new_node.inputData = existing_child.outputData exactly.\n" +
        "   STEP 4: Write new_node.functionCode to operate on those keys (e.g., filter, count, summarize).\n" +
        "   DO NOT set new_node.inputData to GroupNode.inputData — that breaks the pipeline chain.\n";
    } else {
      crossViolationNote +=
        "\n⚠️ MULTI-VALIDATOR NOTE: GroupNode Min Children and GroupNode Pipelines are SEPARATE issues on DIFFERENT groups.\n" +
        "   Fix Min Children: add a 2nd child node to the under-populated GroupNode (use nodes.create with fresh IDs).\n" +
        "   Fix Pipeline: apply Strategy A (extend prevNode to pass through missing keys) on the broken pair.\n" +
        "   These fixes are INDEPENDENT — do both in the same response.\n";
    }
  }

  // Compute MIN_CHILDREN deficit map and inject into note for any min-children violation
  if (hasMinChildren && allNodes) {
    const minChildViolation = violations.find(v => v.validatorName === "GroupNode Min Children");
    if (minChildViolation?.result.affectedNodes) {
      const childCounts = new Map<string, number>();
      allNodes.forEach(n => {
        if (n.parentNode) childCounts.set(n.parentNode, (childCounts.get(n.parentNode) ?? 0) + 1);
      });
      let totalCreatesNeeded = 0;
      const deficitLines: string[] = [];
      for (const group of minChildViolation.result.affectedNodes) {
        const current = childCounts.get(group.id) ?? 0;
        const needed = Math.max(0, 2 - current);
        if (needed > 0) {
          totalCreatesNeeded += needed;
          const title = (group.data as { title?: string }).title ?? group.id;
          deficitLines.push(`   • "${title}" (${group.id}): has ${current} child(ren) → CREATE ${needed} more`);
        }
      }
      if (totalCreatesNeeded > 0) {
        crossViolationNote +=
          `\n⚠️ MIN CHILDREN DEFICIT — you MUST create EXACTLY ${totalCreatesNeeded} new node(s) total:\n` +
          deficitLines.join("\n") + "\n" +
          "   Fix ALL groups in this single response. Each group must reach ≥2 children after your creates.\n" +
          "   ❌ Do NOT stop after fixing 1 group — fix every group listed above.\n";
      }
    }
  }

  const header =
    `CRITICAL: Fix ALL violations listed below in a SINGLE response.${crossViolationNote}\n`;

  // Violations where parent outputData context helps AI repair correctly
  const needsParentContext = new Set(["Empty Data Shape", "Parent-Child Data Flow"]);

  const entries = violations.map(({ validatorName, result }, i) => {
    const affectedIds = result.affectedNodes?.map((n) => n.id) ?? [];
    const guidance = getFixGuidance(validatorName, result);
    const nodeContexts = (result.affectedNodes ?? []).map((n) =>
      extractNodeExecutionContext(n),
    );

    // Inject parent-node outputData for data-shape/flow violations so AI can
    // cross-reference without guessing what parent produces.
    let parentContextBlock: string | null = null;
    if (allNodes && needsParentContext.has(validatorName) && result.affectedNodes) {
      const parentContexts = result.affectedNodes
        .map((n) => {
          const ctx = extractParentContext(n, allNodes);
          if (!ctx) return null;
          return { forNodeId: n.id, ...ctx };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      if (parentContexts.length > 0) {
        parentContextBlock =
          `    PARENT NODE CONTEXT (for cross-node inference — DO NOT modify parent unless required):\n` +
          JSON.stringify(parentContexts, null, 2)
            .split("\n")
            .map((l) => `      ${l}`)
            .join("\n");
      }
    }

    // Parent Node Structure + GroupNode Min Children + Parent-Child Data Flow + GroupNode Pipelines: show all valid node IDs
    let validNodeIdsBlock: string | null = null;
    if ((validatorName === "Parent Node Structure" || validatorName === "GroupNode Min Children" || validatorName === "Parent-Child Data Flow" || validatorName === "GroupNode Pipelines") && allNodes) {
      const validIdLines = allNodes.map(
        (n) =>
          `      - "${n.id}" (${n.type}: "${(n.data as { title?: string }).title ?? "untitled"}")`,
      );
      validNodeIdsBlock =
        `    VALID NODE IDs (use ONLY these for parentNode — do NOT invent new IDs):\n` +
        validIdLines.join("\n");
    }

    // OUTPUT_DATA_TYPE_MISMATCH: inject actualOutput so AI knows exactly what functionCode returns
    let actualOutputBlock: string | null = null;
    if (validatorName === "outputData Type Mismatch" && result.metadata?.mismatches) {
      type MismatchEntry = { node: { id: string }; inputData: unknown; expectedOutput: unknown; actualOutput: unknown };
      const mismatches = result.metadata.mismatches as MismatchEntry[];
      if (mismatches.length > 0) {
        const lines = mismatches.map((m) =>
          `      { nodeId: "${m.node.id}", actualOutput: ${JSON.stringify(m.actualOutput)}, expectedOutput: ${JSON.stringify(m.expectedOutput)} }`,
        );
        actualOutputBlock =
          `    ACTUAL EXECUTION RESULTS (what functionCode ACTUALLY returns — update outputData to match this):\n` +
          lines.join("\n");
      }
    }

    // GroupNode Pipelines: show full sorted pipeline for each affected GroupNode
    let pipelineContextBlock: string | null = null;
    if (validatorName === "GroupNode Pipelines" && allNodes && result.affectedNodes) {
      const affectedGroupIds = new Set<string>();
      result.affectedNodes.forEach((n) => {
        if (n.type === "group") affectedGroupIds.add(n.id);
        else if (n.parentNode) affectedGroupIds.add(n.parentNode);
      });

      if (affectedGroupIds.size > 0) {
        const pipelineContexts = [...affectedGroupIds].map((groupId) => {
          const groupNode = allNodes.find((n) => n.id === groupId);
          const gd = groupNode?.data as Record<string, unknown> | undefined;
          const gCfg = (gd?.execution as { config?: { nodeData?: { inputData?: unknown; outputData?: unknown } } } | undefined)?.config;
          const children = allNodes
            .filter((n) => n.parentNode === groupId && n.type !== "decision")
            .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0))
            .map((c) => {
              const cd = c.data as Record<string, unknown>;
              const cfg = (cd.execution as { config?: { nodeData?: { inputData?: unknown; outputData?: unknown }; functionCode?: string } } | undefined)?.config;
              return {
                id: c.id,
                type: c.type,
                title: cd.title,
                inputData: cfg?.nodeData?.inputData,
                outputData: cfg?.nodeData?.outputData,
                hasFunctionCode: !!cfg?.functionCode?.toString().trim(),
              };
            });
          return {
            groupId,
            groupTitle: (gd?.title as string) ?? "Untitled Group",
            groupInputData: gCfg?.nodeData?.inputData,
            groupOutputData: gCfg?.nodeData?.outputData,
            pipeline: children,
          };
        });

        pipelineContextBlock =
          `    FULL GROUPNODE PIPELINE (ALL children sorted by y-position — fix the ENTIRE chain, not just the broken pair):\n` +
          JSON.stringify(pipelineContexts, null, 2)
            .split("\n")
            .map((l) => `      ${l}`)
            .join("\n");
      }
    }

    return [
      `[${i + 1}] VIOLATION: ${validatorName}`,
      `    AFFECTED NODES: ${JSON.stringify(affectedIds)}`,
      nodeContexts.length > 0
        ? `    CURRENT STATE:\n${JSON.stringify(nodeContexts, null, 2)
            .split("\n")
            .map((l) => `      ${l}`)
            .join("\n")}`
        : null,
      validNodeIdsBlock,
      pipelineContextBlock,
      parentContextBlock,
      actualOutputBlock,
      `    ISSUE: ${result.errorMessage ?? `Error type: ${result.errorType}`}`,
      `    FIX REQUIRED: ${guidance}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  // violations.forEach(({ validatorName }, i) => {
  //   if (validatorName === "GroupNode Pipelines") {
  //     console.group("[BatchRepair] GroupNode Pipelines entry");
  //     console.log(entries[i]);
  //     console.groupEnd();
  //   }
  // });

  console.log("--------------header-------------", header);
  console.log();
  return [header, ...entries].join("\n\n");
}
