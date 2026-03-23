/**
 * Shared AI Prompt Components
 *
 * This module contains core workflow rules and validation logic shared between
 * workflow generation and modification.
 *
 * Refactored Focus:
 * - NO Edge generation (handled by system)
 * - NO Start/End node generation (handled by system)
 * - Strict ParentNode logic
 * - Decision Node branching rules (branchLabel)
 * - Mandatory Data Fields & Defaults
 */

export const CORE_NODE_TYPES = `
AVAILABLE NODE TYPES & MANDATORY DATA FIELDS:

1. **Task Node** ("task")
   - Represents a manual action or general step.
   - **REQUIRED \`data\` fields**:
     - \`title\`: string
     - \`description\`: string
     - \`assignee\`: string (Default: "")
     - \`estimatedTime\`: number (Default: 0)
     - \`metadata\`: object (Default: {})
     - \`execution\`: object (**REQUIRED**)
       - \`config.functionCode\`: business logic implementation (function body only, no "function" wrapper)
         - **CRITICAL**: Receives \`inputData\` (output from parent node) as parameter
         - **EXCEPTION**: If parent is a START NODE, inputData will be NULL
           - ❌ Wrong (start child): \`return inputData.tasks.length;\`
           - ✅ Correct (start child): \`return { tasks: [{id:'task-1',content:'Buy milk',completed:false,date:'2026-01-01'},{id:'task-2',content:'Read book',completed:true,date:'2026-01-01'},{id:'task-3',content:'Exercise',completed:false,date:'2026-01-01'}] };\` // initialize data from scratch with 3+ representative elements
         - ALL data MUST be accessed via \`inputData.<field>\` — NEVER reference fields directly
         - ❌ Wrong: \`return tasks.length <= maxTasks\`
         - ✅ Correct: \`return inputData.tasks.length <= maxTasks\`
         - **CRITICAL SCOPE RULE**: functionCode has ONLY 1 variable available:
           1. \`inputData\` - Data from parent node's output

         - **⚠️ SYNC-ONLY — ABSOLUTE RULE**:
           Task nodes MUST be synchronous. NEVER write the following in a task node's functionCode:
           - ❌ \`await\` anything
           - ❌ \`async function\` or \`async () =>\`
           - ❌ \`.then()\` / \`.catch()\` chaining
           - ❌ \`new Promise(...)\`
           - ❌ \`fetch(...)\` — HTTP/API calls are for ServiceNodes ONLY
           If your logic requires an HTTP request or any async operation:
           → You MUST create a **ServiceNode** (type: "service") for that step, NOT a TaskNode.
           ❌ BAD (task node with API call):
             functionCode: "const res = await fetch('/api/tasks/' + inputData.id); return res.json();"
           ✅ CORRECT: create a ServiceNode with serviceType:"api", http config, isAsync:true

         - **FORBIDDEN REFERENCES**:
           - ❌ NEVER reference \`metadata\`, \`node\`, \`config\`, \`this\`, or any external variables
           - ❌ Wrong: \`metadata.maxTasks\`, \`node.data.title\`, \`config.timeout\`
           - ✅ Correct: Pass all values via \`inputData\`: \`inputData.maxTasks\`, \`inputData.title\`
         - **How to use metadata/config values**:
           - DON'T try to access \`node.data.metadata\` in functionCode (not in scope!)
           - DO pass required values explicitly in \`inputData\`:
             - Example: If you need \`maxTasks\` limit, include it in \`inputData: { maxTasks: 3 }\`
             - Then reference as \`inputData.maxTasks\` in functionCode
         - **CRITICAL**: MUST always end with a \`return\` statement that produces the outputData object
         - ❌ Wrong (no return, mutates inputData): \`inputData.tasks.push(inputData.newTask);\`
         - ✅ Correct (compute new state, return as output): \`const updated = [...inputData.tasks, inputData.newTask]; return { tasks: updated };\`
         - **NULL-SAFE FIELD ACCESS (CRITICAL)**:
           - \`nodeData.inputData\` shows the EXPECTED SHAPE, but field values may be null at runtime
           - ALWAYS use type guards before calling array methods or accessing nested objects:
             - ❌ Wrong: \`inputData ? inputData.tasks.slice(0, 3) : null\`
               (inputData is truthy as an object, but inputData.tasks may still be null)
             - ✅ Correct: \`Array.isArray(inputData?.tasks) ? inputData.tasks.slice(0, 3) : []\`
           - Use optional chaining + nullish coalescing for safe field access:
             - ❌ Wrong: \`inputData.user.name\`
             - ✅ Correct: \`inputData?.user?.name ?? ""\`
           - NEVER rely solely on \`inputData ?\` (object truthy check) before accessing sub-fields as arrays
       - \`config.nodeData.inputData\`: input parameters sample
          - **CRITICAL CONTRACT**: Keys MUST match the \`inputData.xxx\` accesses in functionCode
          - nodeData.inputData = sample of what functionCode READS (input schema)
          - ❌ Wrong: functionCode does \`inputData.tasks.slice(0,3)\` but nodeData.inputData = { displayedTasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Read book",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}] }
          - ✅ Correct: functionCode does \`inputData.tasks.slice(0,3)\` → nodeData.inputData = { tasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Read book",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}] }
       - \`config.nodeData.outputData\`: output result sample
          - Keys MUST match what functionCode RETURNS
          - nodeData.outputData = sample of what functionCode produces (output schema)
          - ✅ Correct (above example): return { displayedTasks: ... } → nodeData.outputData = { displayedTasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Read book",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}] }
     - \`ports\`: array (Default: [
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
      ])

2. **Service Node** ("service")
   - Represents an automated system action (API, Database, etc.).
   - **REQUIRED \`data\` fields**:
     - \`title\`: string
     - \`description\`: string
     - \`mode\`: "panel"
     - \`serviceType\`: "api"
     - \`timeout\`: 10000
     - \`retry\`: object, Default: {retry: 0, delay: 3000}
     - \`http\`: object (**REQUIRED** for ALL serviceTypes)
       - \`method\`: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" (REQUIRED)
       - \`endpoint\`: string (e.g. "/api/users", "/api/meals/{id}") (REQUIRED)
       - \`headers\`: object (REQUIRED, Default: { "Content-Type": "application/json" })
         - MUST match the \`headers\` variable declared in \`functionCode\`
         - Always include \`"Content-Type": "application/json"\` for JSON APIs
       - \`body\`: object (REQUIRED for POST/PUT/PATCH/DELETE, omit for GET)
         - MUST match the \`body\` variable declared in \`functionCode\`
         - Use \`{{inputData.fieldName}}\` syntax to indicate dynamic values from inputData
         - Example: \`{ email: "{{inputData.email}}", password: "{{inputData.password}}" }\`
         - For GET requests, omit this field entirely (not an empty object)
     - **CRITICAL**: For all HTTP endpoints, ALWAYS use \`serviceType: "api"\`

     - \`execution\`: object (**REQUIRED**)
       - \`config.nodeData.isAsync\`: true
       - ⚠️ **DO NOT include \`functionCode\`** — it is AUTO-GENERATED from \`data.http\` (endpoint/method/headers/body).
         The system always calls \`generatePanelCode("service", data)\` which produces the correct \`fetch(...)\` template.
         Including functionCode yourself wastes tokens and may conflict with the generated version.
       - \`config.nodeData.inputData\`: request body/query params sample
       - \`config.nodeData.outputData\`: **REQUIRED** — declares the expected shape of \`response.json()\`:
         - \`null\` → fire-and-forget (response is not used downstream, no child task needed)
         - \`{ ... }\` → declares the shape of the response; a child task node should chain this via inputData
     - \`ports\`: array (Default: [
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
      ])

3. **Decision Node** ("decision")
   - Represents a logical branch (conditional split).
   - **REQUIRED \`data\` fields**:
     - \`title\`: string
     - \`description\`: string
     - \`mode\`: "panel"
     - \`condition\`: ConditionConfig object — Keys MUST be ONLY one of: "has" | "hasNot" | "truthy" | "falsy". Value is the field name from inputData to evaluate.
       - \`"has": "fieldName"\` → passes if inputData.fieldName exists
       - \`"hasNot": "fieldName"\` → passes if inputData.fieldName does not exist
       - \`"truthy": "fieldName"\` → passes if inputData.fieldName is truthy
       - \`"falsy": "fieldName"\` → passes if inputData.fieldName is falsy
       - ❌ Wrong: { "field": "status", "op": "eq", "value": "approved" }
       - ✅ Correct: { "truthy": "isApproved" }
       - ✅ Multiple: { "has": "token", "truthy": "isValid" }
       - Default: {}
     - \`ports\`: array (Default: [
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
      ])
     - \`execution\`: object (**REQUIRED**)
       - ⚠️ **DO NOT include \`functionCode\`** — it is AUTO-GENERATED from \`data.condition\` by the system.
         The system calls \`generatePanelCode("decision", { condition })\` which evaluates the condition operators.
       - \`config.nodeData.inputData\`: input parameters sample
          - Keys determine which fields the condition evaluates (e.g., \`{ isApproved: true }\`)
       - \`config.nodeData.outputData\`: MUST be \`true\` (boolean, AUTO-SET by system) — do NOT include this field
     - **CRITICAL**: Must have at least two children nodes (one 'yes', one 'no').

4. **Group Node** ("group")
   - Represents a feature unit (stateless, composable) containing sequential internal nodes.
   - **REQUIRED \`data\` fields**:
     - \`title\`: string
     - \`description\`: string
     - \`groups\`: array (Default: []) — internal nodes, populated separately by the system
     - \`metadata\`: object (Default: {})
     - \`collapsed\`: boolean (Default: true)
     - \`ports\`: array (Default: [
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
       ])

   **GROUPNODE STRUCTURE RULE (ABSOLUTE):**
   - GroupNode MUST contain at least 2 child nodes (Task/Service/Decision)
   - A GroupNode with only 1 child provides no value as a container
   - If only 1 child is needed: either add a second meaningful child node OR
     dissolve the GroupNode and make the child a standalone node
   - ❌ WRONG: GroupNode with a single child TaskNode
   - ✅ CORRECT: GroupNode with TaskNode → ServiceNode (or any 2+ children)

   **GROUPNODE PIPELINE DATA FLOW RULE (ABSOLUTE):**
   - In a GroupNode pipeline: node[i].inputData MUST be a subset of node[i-1].outputData
   - When node[i] needs keys that node[i-1] does not output:
     → node[i-1] MUST pass through those keys from its OWN inputData
     → e.g., return { ...ownResult, taskId: inputData.taskId, newDetails: inputData.newDetails }
     → Do NOT change node[i].inputData to match node[i-1]'s output
        (node[i]'s inputData reflects its semantic requirements — preserve them)
   - The pass-through pattern is valid because:
     node[i-1].inputData is itself a subset of node[i-2].outputData (or GroupNode.inputData),
     so any key in node[i-1].inputData can safely be forwarded to node[i]
   - ❌ WRONG: Change "Edit Task API" inputData from { taskId, newDetails } to { success, message }
   - ✅ CORRECT: Change "Edit Task" functionCode to return { success: true, message: "...", taskId: inputData.taskId, newDetails: inputData.newDetails }
`;

export const FORBIDDEN_EMPTY_CONVERSION_RULES = `
═══════════════════════════════════════════════════════════════
⛔ FORBIDDEN: EMPTY-VALUE CONVERSION NODES (NEVER GENERATE)
═══════════════════════════════════════════════════════════════

null, undefined, {}, [], "" are STRICTLY DIFFERENT types and values.
Converting between empty values with no real computation is MEANINGLESS.

FORBIDDEN PATTERNS — Do NOT create nodes whose only logic is:
  null → {}          functionCode: "return {};"       outputData: {}
  null → []          functionCode: "return [];"
  null → ""          functionCode: "return '';"
  null → undefined   functionCode: "return;" / "return undefined;"
  {} → []            empty object to empty array
  {} → null          functionCode: "return null;"
  {} → undefined     functionCode: "return undefined;"
  (any empty type → any other empty type, with zero computation)

A node MUST perform REAL computation: fetch data, filter, transform, validate, or compute.

If a GroupNode requires a Task parent (GroupNodes cannot be root nodes):
  - That Task MUST initialize REAL data (session, timestamps, config, user input, etc.)
  - ❌ WRONG:   functionCode: "return {};",  outputData: {}       ← meaningless placeholder
  - ✅ CORRECT: functionCode: "return { userId: null, createdAt: new Date().toISOString() };",
                outputData: { userId: null, createdAt: "" }       ← real initialization

TASK NODE INPUT REQUIREMENT:
- Task nodes with non-null inputData MUST reference inputData fields in functionCode.
- ❌ FORBIDDEN: inputData: { tasks: [] } with functionCode: "return { result: [] };"
  → inputData fields are completely ignored — this is a trivial/fabricating node
- ✅ REQUIRED: functionCode must read from inputData (e.g., inputData.tasks, inputData.userId)
- Exception: ServiceNodes may use fetch() without referencing inputData fields.
- Exception: Start node children have inputData: null and initialize data from scratch.
`;

export const PARENT_CHILD_RULES = `
═══════════════════════════════════════════════════════════════
🔗 PARENT-CHILD CONNECTION RULES (ABSOLUTE)
═══════════════════════════════════════════════════════════════

1. **ParentNode Mandatory Reference**
   - Every node you create must refer to a \`parentNode\`.
   - The \`parentNode\` must be the \`id\` of another node in the workflow.
   - **Exception**: In a fresh Generation, the very first node (root) may omit \`parentNode\`.
     - Root node MUST be type "task", "service", or "decision" — NEVER "group"
   - **SELF-CHECK (MANDATORY)**: Before finalizing output, scan your entire node list.
     For every node with a \`parentNode\`, confirm that exact ID string appears as an \`id\`
     in another node in the same response. If not → fix it before outputting.
   - ❌ FATAL: \`"parentNode": "node-task-xyz"\` when no node has \`"id": "node-task-xyz"\`

2. **Decision Node Logic (BranchLabels)**
   - IF a node's \`parentNode\` is a **Decision Node**:
     - You MUST include \`branchLabel\` in the \`data\` object.
     - Value MUST be either "yes" or "no".
     - This applies to ALL node types: task, service, decision, AND group.
     - Example (GroupNode as "yes" branch): \`"data": { "branchLabel": "yes", "title": "Success Flow", ... }\`
   - IF a node's \`parentNode\` is **NOT** a Decision Node:
     - DO NOT include \`branchLabel\`.

3. **Decision Node Completeness**
   - Every Decision Node MUST have at least ONE child with \`branchLabel: "yes"\`.
   - Every Decision Node MUST have at least ONE child with \`branchLabel: "no"\`.
   - You cannot create a Decision Node with only one branch.

4. **No Edges, No Start/End**
   - DO NOT generate "edges" array.
   - DO NOT generate nodes of type "start" or "end".
   - Focus ONLY on the functional nodes (task, service, decision, group).

5. **No Circular parentNode References (CRASH PREVENTION)**
   - NEVER create circular parentNode chains.
   - If Node A sets parentNode = B's id, then Node B MUST NOT set parentNode = A's id.
   - More generally: following parentNode links must always reach a root node (no parentNode). A chain must never loop.
   - ❌ FATAL — causes "Maximum call stack exceeded" crash that users cannot recover from:
     { "id": "node-task-A", "parentNode": "node-task-B" }  ← A points to B
     { "id": "node-task-B", "parentNode": "node-task-A" }  ← B points BACK to A ← CRASH
   - ✅ CORRECT — chain always flows toward root:
     { "id": "node-task-A" }                               ← root (no parentNode)
     { "id": "node-task-B", "parentNode": "node-task-A" }  ← A is parent
     { "id": "node-task-C", "parentNode": "node-task-B" }  ← B is parent
   - SELF-CHECK: For each node, trace parentNode → parentNode → ... until null.
     If you encounter a node ID already seen in that trace → you have a cycle. Fix it before outputting.
`;

export const COMMON_VALIDATION_RULES = `
VALIDATION CHECKLIST (Self-Correction):

□ **Correct ID Format?** (node-\${type}-\${uuid}) // uuid format: [8-4-4-4-12 char]
□ **No "edges" field?** (System handles edges)
□ **No "start" or "end" nodes?** (System handles them)
□ **parentNode Cross-Reference Check (CRITICAL)**:
   - List all node \`id\` values in your response.
   - For every non-root node, confirm its \`parentNode\` value appears in that list.
   - ❌ If any \`parentNode\` does NOT match an actual \`id\` → rewrite before outputting.
   - This is a FATAL error that breaks the entire workflow.
□ **Circular parentNode Cycle Check (CRASH PREVENTION)**:
   - For every node, trace: node.parentNode → that node's parentNode → ... until undefined.
   - If you see the same node ID twice in a trace → CIRCULAR REFERENCE. Fix before outputting.
   - ❌ FATAL: A → B → A (any length cycle causes "Maximum call stack exceeded" app crash)
□ **Data Fields Complete?**
   - Task: title, description, assignee, estimatedTime, execution.config, ports
   - Service: title, description, serviceType, http, execution.config, ports
   - Decision: title, description, condition, ports
   - Group: title, description, groups, ports
□ **Decision Node Check:**
   - Does every decision node have a "yes" child?
   - Does every decision node have a "no" child?
□ **BranchLabel Check:**
   - Do children of decision nodes have \`branchLabel\` ("yes"/"no")?
   - Do children of non-decision nodes OMIT \`branchLabel\`?
□ **functionCode MANDATORY CHECK (CRITICAL)**:
   - EVERY **task** node MUST have functionCode as a non-empty string
   - ⚠️ **Service and decision nodes: functionCode is AUTO-GENERATED — do NOT include it**
     The system generates service functionCode from \`data.http\` and decision functionCode from \`data.condition\`.
   - ❌ Wrong (task node missing functionCode): \`{ "execution": { "config": { "nodeData": {...} } } }\`
   - ✅ Correct (task node): \`{ "execution": { "config": { "functionCode": "return inputData;", "nodeData": {...} } } }\`
   - This applies to ALL task nodes — including GroupNode internal child task nodes
   - NEVER use template syntax \`{{inputData.key}}\` inside nodeData.inputData/outputData samples
     (templates are ONLY for data.http.body, not for execution schema samples)
   - ❌ Wrong: \`"nodeData": { "inputData": { "taskId": "{{inputData.taskId}}" } }\`
   - ✅ Correct: \`"nodeData": { "inputData": { "taskId": "mock-task-id" } }\`
   - ⚠️ WRONG PLACEMENT: functionCode MUST be directly inside config, NOT inside config.nodeData
   - ❌ WRONG: \`{ "config": { "nodeData": { "functionCode": "...", "inputData": {}, "outputData": {} } } }\`
   - ✅ CORRECT: \`{ "config": { "functionCode": "...", "nodeData": { "inputData": {}, "outputData": {} } } }\`
□ **Task Node Existence Check (CRITICAL)**:
   - For EACH task node: does it perform real computation (transform/filter/validate/compute)?
     If NOT → DO NOT generate it. Delete it.
   - Is inputData deepEqual to outputData (same keys + same sample values)?
     If YES → The node is a trivial passthrough → DELETE it.
   - ❌ WRONG: inputData: { tasks: [] } and outputData: { tasks: [] } with no real functionCode
     → identical structure → meaningless node → DELETE
   - ✅ CORRECT: Only generate a task node when it produces genuinely different output
□ **Execution Config Check:**
   - Do Task nodes have \`execution.config.functionCode\`?
   - Do Service nodes have \`execution.config.nodeData\` with inputData and outputData? (functionCode is AUTO-GENERATED — do NOT write it)
   - Are \`inputData\` and \`outputData\` samples provided?
   - Is \`functionCode\` written as function body only (no "function" or "async function" wrapper)?
   - Does \`functionCode\` end with a \`return\` statement? (Task: MUST return outputData object; Decision: MUST return boolean)
□ **GroupNode Boundary Contract (CRITICAL — prevents output_boundary violations)**:
   For EVERY GroupNode you generate:
   a) GroupNode.nodeData.inputData MUST EXACTLY MATCH parent.outputData (same keys + values)
   b) GroupNode.nodeData.outputData MUST EXACTLY MATCH lastChild.outputData (same keys + values)
   PROCEDURE: Generate ALL children first. THEN set GroupNode.outputData = lastChild.outputData.
   - ❌ WRONG: GroupNode.outputData={"tasks":[...]} when lastChild.outputData={"success":true,"taskId":"t1"}
   - ✅ CORRECT: GroupNode.outputData={"success":true,"taskId":"t1"} (copy of lastChild.outputData)
□ **nodeData Schema Contract (CRITICAL)**:
   - nodeData.inputData keys MUST match the \`inputData.xxx\` accesses in functionCode
   - nodeData.outputData keys MUST match what functionCode returns
   - ❌ Wrong: functionCode reads inputData.tasks → but nodeData.inputData has { displayedTasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Read book",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}] }
   - ✅ Correct: functionCode reads inputData.tasks → nodeData.inputData = { tasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Read book",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}] }
              functionCode returns { displayedTasks: ... } → nodeData.outputData = { displayedTasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Read book",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}] }
□ **inputData Reference Check:**
   - Does \`functionCode\` use \`inputData.<field>\` (not bare variable names)?
   - ❌ Wrong: \`tasks.length\`, \`userId\`, \`email\`, \`endpoint\`
   - ✅ Correct: \`inputData.tasks.length\`, \`inputData.userId\`, \`inputData.email\`
□ **Array Safety Check (CRITICAL — prevents runtime crash)**:
   - EVERY array method (.slice, .map, .filter, .forEach, .reduce) MUST be guarded with Array.isArray()
   - ❌ Wrong: \`inputData.tasks.slice(0, 3)\` — crashes if tasks is undefined!
   - ❌ Wrong: \`inputData ? inputData.tasks.slice(0, 3) : null\` — inputData truthy ≠ inputData.tasks defined!
   - ✅ Correct: \`Array.isArray(inputData?.tasks) ? inputData.tasks.slice(0, 3) : []\`
□ **nodeData.inputData Type Defaults (CRITICAL — arrays need EXACTLY 3+ elements):**
   - The validator counts array length. 0, 1, or 2 elements ALL fail. You need 3 or more.
   - ❌ Wrong: \`"inputData": { "tasks": null }\` (null placeholder for a key that should have a value)
   - ❌ Wrong: \`"inputData": { "tasks": [] }\` (0 elements — cannot infer type)
   - ❌ Wrong: \`"inputData": { "tasks": [{...}] }\` (1 element — STILL fails, need 3+)
   - ❌ Wrong: \`"inputData": { "tasks": [{...},{...}] }\` (2 elements — STILL fails, need 3+)
   - ❌ Wrong: \`"inputData": { "tasks": ["a", "b"] }\` (fewer than 3 elements)
   - ✅ Correct: \`"inputData": { "tasks": [{id:"t1",...},{id:"t2",...},{id:"t3",...}] }\` (exactly 3+ representative elements)
   - ✅ Correct: \`"inputData": null\` for start-node children or GET service nodes with no body params
□ **nodeData.outputData Type Defaults (CRITICAL — same rules as inputData)**:
   - ❌ Wrong: \`"outputData": {}\` (empty object — use null if node produces no output)
   - ❌ Wrong: \`"outputData": { "tasks": [] }\` (empty array — cannot infer element type)
   - ❌ Wrong: \`"outputData": { "tasks": [{}] }\` (array of empty objects — still a violation)
   - ✅ Correct: \`"outputData": null\` when functionCode returns nothing useful
   - ✅ Correct: \`"outputData": { "tasks": [{id:"t1",content:"Buy milk",completed:false},{id:"t2",content:"Exercise",completed:true},{id:"t3",content:"Read book",completed:false}] }\` with 3+ realistic elements
   - CONTRACT: if functionCode returns \`{ outKey: inputData.inKey }\`, outputData[outKey] MUST mirror inputData[inKey]
     ❌ Wrong: functionCode: \`"return { displayedTasks: inputData.tasks };"\` with outputData: \`{ displayedTasks: [] }\`
     ✅ Correct: outputData.displayedTasks = same structure/elements as inputData.tasks
   - NESTED ARRAYS RULE (CRITICAL): Arrays nested inside objects of other arrays MUST ALSO have 3+ elements.
     ❌ Wrong: \`{ games: [{id:"g1", participants:[]}, {id:"g2", participants:[]}, {id:"g3", participants:[]}] }\`
     ✅ Correct: \`{ games: [{id:"g1", participants:[{userId:"u1",name:"Alice"},{userId:"u2",name:"Bob"},{userId:"u3",name:"Carol"}]}, {id:"g2", participants:[{userId:"u4",name:"Dan"},{userId:"u5",name:"Eve"},{userId:"u6",name:"Frank"}]}, {id:"g3", participants:[{userId:"u7",name:"Gina"},{userId:"u8",name:"Hank"},{userId:"u9",name:"Iris"}]}] }\`
     This applies to ALL nested arrays: members[], participants[], items[], comments[], tags[], etc.
□ **Execution Scope Check:**
   - Does functionCode ONLY use \`inputData\` and \`fetch\`?
   - Does functionCode avoid referencing \`metadata\`, \`node\`, \`config\`, or other external variables?
   - ❌ FORBIDDEN: \`metadata.maxTasks\`, \`node.data.title\`, \`config.timeout\`, \`this.value\`
   - ✅ REQUIRED: \`inputData.maxTasks\`, \`inputData.title\`, \`inputData.timeout\`
   - If config values are needed, include them in \`inputData\` schema
□ **GroupNode initFunctionCode Check (CRITICAL)**:
   - GroupNode MUST have \`"initFunctionCode": "return inputData;"\` — ALWAYS, no data transformation
   - The system auto-chains: groups[0].nodeData.inputData = GroupNode.nodeData.inputData = parent.outputData
   - If groups[0] needs to reshape parent data, put that logic in groups[0].functionCode, not here
   - ❌ Wrong: \`"initFunctionCode": "return { date: inputData?.currentDate ?? '', tasks: [] };"\` (transformation!)
   - ✅ Correct: \`"initFunctionCode": "return inputData;"\` (always pass-through)
□ **Start Node Child Check:**
   - Do children of start nodes have \`inputData: null\`?
   - Does functionCode in start node children avoid referencing inputData?
   - Start nodes produce NO OUTPUT → children receive null input
□ **ServiceType Validation:**
   - Is \`serviceType: "api"\` for all nodes with \`http.method\` and \`http.endpoint\`?
   - Are you NOT using "database" or "email" for HTTP endpoints?
□ **Metadata Mapping**: (Task) Are all sub-requirements in \`data.metadata\`?
□ **Description Minimalism**: (Task) Is description a single summary sentence?
□ **API Granularity**: (Service) Is each API/logic in its own node?
□ **Schema Format**: (Service) Are \`request_schema\` & \`response_schema\` in {key: "value"} format?
□ **HTTP Config Synchronization**: (Service)
   - Does \`data.http.method\` match the \`method\` variable in functionCode?
   - Does \`data.http.endpoint\` match the \`endpoint\` variable in functionCode?
   - Does \`data.http.headers\` match the \`headers\` variable in functionCode?
   - For non-GET methods: Does \`data.http.body\` structure match the \`body\` variable in functionCode?
   - For GET methods: Is \`data.http.body\` field omitted (not present)?
□ **HTTP Headers**: (Service)
   - Does \`data.http.headers\` include \`{ "Content-Type": "application/json" }\`?
   - Does this match the \`headers\` variable in functionCode?
□ **HTTP Body**: (Service)
   - For POST/PUT/PATCH/DELETE: Is \`data.http.body\` populated with field structure?
   - Does \`data.http.body\` use \`{{inputData.fieldName}}\` syntax for dynamic values?
   - For GET: Is \`body\` field omitted entirely?
`;

export const TECHNICAL_SPECIFICATION_RULES = `
═══════════════════════════════════════════════════════════════
🛠️ FULL-STACK TECHNICAL SPECIFICATION RULES (DEV-READY)
═══════════════════════════════════════════════════════════════

1. **Task Node Metadata Mapping**:
   - DO NOT use lists in \`description\`. Move all sub-features to \`data.metadata\`.
   - Each key in \`metadata\` should represent a specific requirement or variable.

2. **Service Node functionCode**: AUTO-GENERATED by system from \`data.http\`. NEVER write functionCode for service nodes — the system calls \`generatePanelCode("service", data)\` after your response.

3. **Decision Node functionCode**: AUTO-GENERATED by system from \`data.condition\`. NEVER write functionCode for decision nodes — the system calls \`generatePanelCode("decision", { condition })\` after your response. Only set \`data.condition\` with the correct operators.

4. **Decision Node: Return Format**:
   - Decision nodes MUST return a plain boolean value (true or false)
   - The workflow engine uses this boolean to select the yes/no branch and passes the decision's inputData to the chosen child
   - ❌ Wrong: \`return { ...inputData, success: inputData.status === 'active' };\` (object — forbidden)
   - ❌ Wrong: \`return { result: 'approved' };\` (object — forbidden)
   - ✅ Correct: \`return inputData.status === 'active';\` (plain boolean)
   - ✅ Correct: \`return Boolean(inputData.token);\` (plain boolean)
   - Also set \`nodeData.outputData\` to \`true\` (boolean sample, NOT an object)

5. **Sequential Flow for Roles**:
   - Start with a **Task Node (PRD)** defining requirements.
   - Follow with **Service Node (Backend)** defining the API.
   - Branch with **Decision Node (Logic/QA)** to handle Success/Error paths.
   - End with **Task Nodes (Frontend)** for UI feedback (e.g., "Show Toast Error").

6. **Atomic Logic Steps**:
   - In \`description\`, use numbered steps for execution logic.
   - Example: "1. Validate Request, 2. Database Insert, 3. Send Auth Email."

7. **Error Handling**:
   - Every "no" branch from a Decision node must lead to a specific error handling flow.

8. **Structured Collaboration Flow**:
   - **PRD (Task)**: Define "What to build" in metadata.
   - **Backend (Service)**: Define "How to fetch/save" in functionCode & schemas.
   - **QA (Decision)**: Define "What determines success" in boolean logic.
   - **Frontend (Task)**: Define "How to show" based on results.
`;

export const SERVICE_NODE_MOCK_DATA_RULES = `
═══════════════════════════════════════════════════════════════
🎭 SERVICE NODE MOCK DATA GENERATION RULES (SIMULATION MODE)
═══════════════════════════════════════════════════════════════

CRITICAL: Every Service node MUST include realistic mock response in config.nodeData.outputData

1. **Match Real API Structure**:
   - Research the actual endpoint response format
   - Include all fields that downstream nodes will reference
   - Use realistic data types and values (not placeholders)
   - Example GET /api/users → { "data": [{"id": 1, "name": "John Doe", "email": "john@example.com"}], "total": 1 }
   - Example POST /api/auth/login → { "success": true, "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "user": {"id": 1, "name": "John Doe", "email": "john@example.com", "role": "admin"} }
   - Example POST /api/orders → { "success": true, "orderId": "ORD-123", "status": "pending", "createdAt": "2024-12-25T10:00:00Z" }

2. **Decision Node Integration** (CRITICAL):
   - If Service node feeds into Decision node, outputData MUST include success field
   - Example success: { "success": true, "data": {...} } → Decision takes "yes" branch
   - Example failure: { "success": false, "error": "Invalid credentials", "code": 401 } → Decision takes "no" branch
   - This allows users to test different Decision paths by editing mockResponse

3. **Mock Data Config**:
   - Always provide realistic nodeData.outputData for all AI-generated Service nodes
   - This allows instant workflow testing in simulation mode without real API calls
   - Example:
     \`\`\`json
     {
       "execution": {
         "config": {
           "functionCode": "const res = await fetch(...); return await res.json();",
           "isAsync": true,
           "nodeData": {
             "inputData": { "email": "user@example.com", "password": "password123" },
             "outputData": { "success": true, "token": "jwt...", "user": {...} }
           }
         }
       }
     }
     \`\`\`

4. **Common API Response Patterns**:
   - GET requests: Include data array, pagination info (total, page, limit)
   - POST requests: Include success boolean, created resource ID, timestamp
   - Error responses: Include success: false, error message, error code
   - Authentication: Include token, user object, expiration time
`;
