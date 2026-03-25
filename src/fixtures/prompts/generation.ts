import { buildPrompt } from "./utils";
import {
  CORE_NODE_TYPES,
  FORBIDDEN_EMPTY_CONVERSION_RULES,
  PARENT_CHILD_RULES,
  COMMON_VALIDATION_RULES,
  TECHNICAL_SPECIFICATION_RULES,
  SERVICE_NODE_MOCK_DATA_RULES,
} from "./common";
import { buildPRDContext } from "@/utils/ai/contextBuilder";
import { GenerateWorkflowActionParams } from "@/types";

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

   ⛔ GROUPNODE NESTING RULE (prevents BROKEN_GROUPNODE_PIPELINES):
   Feature-level GroupNodes MUST be SIBLINGS — NEVER nest one feature GroupNode inside another feature GroupNode's pipeline.
   Children inside a GroupNode pipeline MUST be type "task", "service", or "decision" — NEVER type "group".

   ❌ WRONG — "Add Task" GroupNode's pipeline child is another GroupNode ("View Tasks"):
     { "id": "node-group-add-task", "type": "group", "parentNode": "node-task-root" }
     { "id": "node-service-save", "type": "service", "parentNode": "node-group-add-task" }
     { "id": "node-group-view-tasks", "type": "group", "parentNode": "node-group-add-task" }  ← FATAL: group inside group pipeline

   ✅ CORRECT — All feature GroupNodes share the SAME parentNode (the root task):
     { "id": "node-task-root-001",       "type": "task",    "parentNode": null }
     { "id": "node-group-add-task-002",  "type": "group",   "parentNode": "node-task-root-001" }
     { "id": "node-group-view-tasks-003","type": "group",   "parentNode": "node-task-root-001" }
     { "id": "node-group-edit-task-004", "type": "group",   "parentNode": "node-task-root-001" }
     // Children of "Add Task" — task/service/decision ONLY:
     { "id": "node-task-prepare-005",    "type": "task",    "parentNode": "node-group-add-task-002" }
     { "id": "node-service-save-006",    "type": "service", "parentNode": "node-group-add-task-002" }
     // Children of "View Tasks" — task/service/decision ONLY:
     { "id": "node-service-fetch-007",   "type": "service", "parentNode": "node-group-view-tasks-003" }
     { "id": "node-task-display-008",    "type": "task",    "parentNode": "node-group-view-tasks-003" }

   KEY RULE: parentNode of every GroupNode = the ROOT TASK node ID.
   NEVER set parentNode of a feature GroupNode to another feature GroupNode's ID.
   NEVER set parentNode of a feature GroupNode to an intermediate task node that is itself a sibling feature step.

   ⛔ SEQUENTIAL CHAIN ANTI-PATTERN (causes PARENT_CHILD_DATA_FLOW violation):
   Features are INDEPENDENT, not steps in a pipeline. Think of them like navigation menu items.
   ❌ WRONG — features chained sequentially (each feature is a child of the previous):
     Root Task (outputs {tasks:[]})
       └─ "Add New Task" task (outputs {newTask:{...}})
           └─ "Edit Task" group (expects {tasks:[]} ← MISMATCH: parent outputs {newTask}, not {tasks})
               └─ "Prepare Edit Task" task (outputs {editedTask:{...}})
                   └─ "Delete Task" group (expects {tasks:[]} ← MISMATCH)

   ✅ CORRECT — ALL features are siblings under the root task (ALL share the same root outputData):
     Root Task (outputs {tasks:[t1,t2,t3]})
       ├─ "Add Task" group    (parentNode=Root, inputData={tasks:[...]})
       ├─ "View Tasks" group  (parentNode=Root, inputData={tasks:[...]})
       ├─ "Edit Task" group   (parentNode=Root, inputData={tasks:[...]})
       └─ "Delete Task" group (parentNode=Root, inputData={tasks:[...]})

   RULE: If N features all need the same data (e.g., the task list), they must ALL be siblings
   that receive it from the SAME root parent — not chained one after another.

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
             "functionCode": "return { tasks: [{id:'task-1',content:'Buy milk',completed:false,date:'2026-01-01'},{id:'task-2',content:'Read book',completed:true,date:'2026-01-01'},{id:'task-3',content:'Exercise',completed:false,date:'2026-01-01'}] };",
             "nodeData": { "inputData": null, "outputData": { "tasks": [{"id":"task-1","content":"Buy milk","completed":false,"date":"2026-01-01"},{"id":"task-2","content":"Read book","completed":true,"date":"2026-01-01"},{"id":"task-3","content":"Exercise","completed":false,"date":"2026-01-01"}] } }
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
     - nodeData.inputData/outputData values MUST use representative sample data — NOT null, NOT empty:
       - Arrays → at least 3 elements: \`["item1", "item2", "item3"]\` (NOT \`[]\` or \`["a", "b"]\`)
       - Objects → at least 1 key-value pair: \`{ key: "value" }\` (NOT \`{}\`)
       - Strings → use \`""\` (not null)
       - Numbers → use \`0\` (not null)
     - \`null\` is ONLY valid for \`nodeData.inputData\` itself (start node children)
     - ❌ Wrong: \`"nodeData": { "inputData": { "tasks": null } }\` (null placeholder)
     - ❌ Wrong: \`"nodeData": { "inputData": { "tasks": [] } }\` (empty array — cannot infer type)
     - ❌ Wrong: \`"nodeData": { "inputData": { "tasks": ["a", "b"] } }\` (fewer than 3 elements)
     - ✅ Correct: \`"nodeData": { "inputData": { "tasks": ["Task 1", "Task 2", "Task 3"] } }\`

4. PRD REFERENCES (REQUIRED FOR EVERY NODE)
   - Every node MUST include prdReference.section: the PRD page/section this node belongs to
   - Example: { "prdReference": { "section": "User Authentication" } }

7. FUNCTIONAL PROGRAMMING STYLE
   - GroupNode = Feature unit (stateless, composable)
   - Internal nodes = Pure functions (task/service/decision)
   - Data flows sequentially through internal nodes
   - Each node should have single responsibility
   - Avoid side effects in TaskNodes (use ServiceNodes for external calls)
   - **EVERY internal node (task/service) inside a GroupNode MUST have execution.config.functionCode**
   - ❌ Wrong internal task: \`{ "execution": { "config": { "nodeData": {...} } } }\`  // no functionCode!
   - ❌ Wrong: nodeData.inputData sample uses template syntax \`"{{inputData.key}}"\`
   - ✅ Correct: nodeData.inputData uses actual sample values: \`{ "taskId": "mock-task-id" }\`

   **GroupNode execution.config (MANDATORY)**:
   - EVERY GroupNode MUST have execution.config with:
     * \`initFunctionCode\`: ALWAYS \`"return inputData;"\` — no data transformation, just pass-through
     * \`functionCode\`: output aggregation logic for the whole group
     * \`nodeData.inputData\`: MUST EXACTLY MATCH parent node's outputData (same keys, same sample values)
     * \`nodeData.outputData\`: MUST BE IDENTICAL TO THE LAST CHILD'S nodeData.outputData — copy it exactly
   - ⛔ BOUNDARY CONTRACT (MANDATORY — output_boundary violation if violated):
     * GroupNode.nodeData.inputData = EXACT COPY of parent node's outputData (same keys + values)
     * GroupNode.nodeData.outputData = EXACT COPY of lastChild.nodeData.outputData (same keys + values)
     * groups[0].nodeData.inputData = GroupNode.nodeData.inputData (= parent outputData)
     * groups[i].nodeData.inputData = groups[i-1].nodeData.outputData  (i ≥ 1)
   - ❌ WRONG: GroupNode.outputData={"tasks":[...]} when lastChild.outputData={"success":true,"taskId":"t1"}
   - ✅ CORRECT: GroupNode.outputData={"success":true,"taskId":"t1"} (exact copy of lastChild.outputData)
   - STEP-BY-STEP for each GroupNode:
     1. Generate all child nodes first (their inputData/outputData/functionCode)
     2. After children are done: set GroupNode.outputData = COPY OF lastChild.outputData
     3. Set GroupNode.functionCode to return the same structure as lastChild.outputData
   - CHAINING CONTRACT (system auto-enforces — do NOT override):
   - If groups[0] needs to reshape parent data, put that logic in groups[0].functionCode, NOT in initFunctionCode
   - ❌ Wrong: \`"initFunctionCode": "return { date: inputData?.currentDate ?? '', tasks: [] };"\` (transformation belongs in groups[0].functionCode)
   - ✅ Correct: \`"initFunctionCode": "return inputData;"\` (always)
   - Always use optional chaining (inputData?.field ?? default) to be null-safe
   - Example GroupNode execution.config:
     \`\`\`json
     {
       "execution": {
         "config": {
           "initFunctionCode": "return inputData;",
           "functionCode": "return { tasks: Array.isArray(inputData?.tasks) ? inputData.tasks : [] };",
           "nodeData": {
             "inputData": { "currentDate": "2026-01-01" },
             "outputData": { "tasks": [{"id":"task-1","content":"Buy milk","completed":false,"date":"2026-01-01"},{"id":"task-2","content":"Read book","completed":true,"date":"2026-01-01"},{"id":"task-3","content":"Exercise","completed":false,"date":"2026-01-01"}] }
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
     * nodeData.outputData: the exact data structure that child GroupNodes expect as inputData
   - Parent task nodes (whose children are GroupNodes):
     * nodeData.outputData MUST be semantically compatible with all sibling GroupNodes' expected inputData

   ⛔ ROOT NODE outputData MUST HAVE 3+ EXAMPLE ITEMS — NEVER return empty arrays:
   The nodeData is SAMPLE DATA for type inference — NOT the runtime initial state.
   Even if the app logically starts with zero items at runtime, you MUST provide 3+ realistic examples.
   ❌ WRONG: "return { tasks: [] };"  → outputData.tasks = [] → EMPTY_DATA_SHAPE violation
   ❌ WRONG: "return { tasks: [{ id:'t1', ... }] };"  → outputData.tasks = 1 item → STILL FAILS (need 3+)
   ✅ CORRECT: always return 3+ realistic items:
     "return { tasks: [{id:'task-1',content:'Buy groceries',completed:false,date:'2026-01-01'},{id:'task-2',content:'Read book',completed:true,date:'2026-01-02'},{id:'task-3',content:'Exercise',completed:false,date:'2026-01-03'}] };"

   - ❌ WRONG: root task node with NO execution field → children receive null inputData → TypeError
   - ✅ CORRECT:
     \`\`\`json
     {
       "type": "task",
       "data": {
         "title": "Initialize Tasks",
         "execution": {
           "config": {
             "functionCode": "return { tasks: [{id:'task-1',content:'Buy groceries',completed:false,date:'2026-01-01'},{id:'task-2',content:'Read book',completed:true,date:'2026-01-02'},{id:'task-3',content:'Exercise',completed:false,date:'2026-01-03'}] };",
             "nodeData": {
               "inputData": null,
               "outputData": { "tasks": [{"id":"task-1","content":"Buy groceries","completed":false,"date":"2026-01-01"},{"id":"task-2","content":"Read book","completed":true,"date":"2026-01-02"},{"id":"task-3","content":"Exercise","completed":false,"date":"2026-01-03"}] }
             }
           }
         }
       }
     }
     \`\`\`

9. GROUP NODE INTERNAL DATA CHAIN (MANDATORY)
   - GroupNode internal nodes pass data sequentially: node[0] → node[1] → ... → node[N]
   - CHAINING CONTRACT (only applies when parent has non-null outputData):
     * node[0].nodeData.inputData = GroupNode.nodeData.inputData = parent node's outputData
     * node[i].nodeData.inputData (i ≥ 1) = node[i-1].nodeData.outputData
     * If node[i-1].nodeData.outputData is null → node[i].nodeData.inputData should be null
     * If a node is TRIGGER-STYLE → inputData: null regardless of parent
   - Each internal node's nodeData.inputData MUST match the keys of the preceding node's nodeData.outputData (when non-null)
   - DATA CONTRACT:
     node[i].functionCode returns { key1, key2 }
       → node[i].nodeData.outputData = { key1: ..., key2: ... }
       → node[i+1].nodeData.inputData = { key1: ..., key2: ... }
       → node[i+1].functionCode reads inputData.key1, inputData.key2

   - node[0] specifically: its nodeData.inputData MUST match the shape of the parent GroupNode's
     nodeData.inputData (i.e. the parent node's outputData). Use node[0].functionCode to reshape
     if needed — do NOT rely on initFunctionCode for this.

   ⛔ STEP-BY-STEP CHAIN GENERATION — MANDATORY ORDER:
   When generating 2+ nodes inside a GroupNode, follow this exact order:
   1. Generate node[0] with outputData  (decide what it produces)
   2. Copy node[0].outputData EXACTLY → use as node[1].inputData  (same keys, same sample values)
   3. Write node[1].functionCode using ONLY keys from node[1].inputData
   4. Derive node[1].outputData from what node[1].functionCode returns
   5. Repeat 2→4 for node[2], node[3], etc.
   DO NOT invent new keys for node[i].inputData — they MUST come from node[i-1].outputData.

   ❌ KEY MISMATCH ANTI-PATTERN (most common generation error):
     service/node[0]: outputData = { recognizedFood: [{name:"Apple",calories:95},...] }
     task/node[1]:    inputData  = { meals: [{...}] }  ← WRONG: "meals" is invented — not in service output
     task/node[1]:    functionCode: "return { logged: inputData.meals.map(...) };"  ← WRONG: inputData.meals doesn't exist

   ✅ CORRECT (inputData copied from previous node's outputData):
     service/node[0]: outputData = { recognizedFood: [{name:"Apple",calories:95},{name:"Banana",calories:89},{name:"Orange",calories:62}] }
     task/node[1]:    inputData  = { recognizedFood: [{name:"Apple",calories:95},{name:"Banana",calories:89},{name:"Orange",calories:62}] }  ← EXACT COPY
     task/node[1]:    functionCode: "return { logResult: inputData.recognizedFood.map(f => f.name).join(', ') };"

   - ❌ Wrong (node[0] outputs tasks, but node[1] reads displayedTasks):
     node[0].functionCode: "return { tasks: [...] };"
     node[1].functionCode: "return { result: inputData.displayedTasks.length };"
                                               // ^^^^^^^^^^^^^^^^ key mismatch!

   - ✅ Correct:
     node[0].functionCode: "return { tasks: [...] };"
     node[0].nodeData.outputData: { tasks: [{"id":"t1","content":"Buy milk","completed":false,"date":"2026-01-01"},{"id":"t2","content":"Read book","completed":true,"date":"2026-01-01"},{"id":"t3","content":"Exercise","completed":false,"date":"2026-01-01"}] }
     node[1].nodeData.inputData: { tasks: [{"id":"t1","content":"Buy milk","completed":false,"date":"2026-01-01"},{"id":"t2","content":"Read book","completed":true,"date":"2026-01-01"},{"id":"t3","content":"Exercise","completed":false,"date":"2026-01-01"}] }  // same key as node[0] output
     node[1].functionCode: "return { displayedTasks: Array.isArray(inputData?.tasks) ? inputData.tasks.slice(0, 3) : [] };"
     node[1].nodeData.outputData: { displayedTasks: [{"id":"t1","content":"Buy milk","completed":false,"date":"2026-01-01"},{"id":"t2","content":"Read book","completed":true,"date":"2026-01-01"},{"id":"t3","content":"Exercise","completed":false,"date":"2026-01-01"}] }

11. ANTI-PASSTHROUGH NODE RULE (MANDATORY)
   - DO NOT generate nodes whose only purpose is to pass data unchanged
   - Passthrough node definition: no functionCode (or trivially "return inputData;")
     AND inputData structure = outputData structure (same top-level keys, same types)
   - Such nodes add ZERO value — they only add latency and confusion
   - ❌ WRONG: "Format Data" task where inputData = { tasks: [] } and outputData = { tasks: [] }
     → Remove it. The preceding node should output what the next node expects directly.
   - ✅ CORRECT: Only generate a node when it genuinely transforms, filters, or enriches data
     (different output keys, or same keys with computed/filtered values)
   - If you find yourself creating a passthrough: make the PREVIOUS node output exactly
     what the NEXT node needs — skip the middle node entirely.

11b. FILTER/DELETE NODE inputData SIZE RULE (MANDATORY):
   - When functionCode removes items from an array (filter, splice, delete by ID):
     inputData array MUST have 4+ elements — so outputData after removal still has 3+ elements.
   - ❌ WRONG: inputData.tasks has 3 → after filter → outputData.tasks has 2 (FAILS 3+ requirement)
   - ✅ CORRECT: inputData.tasks has 4 → after filter → outputData.tasks has 3 (passes)
   - Apply this to: Remove Task, Delete Item, Filter List, Clear Completed, etc.

12. TASK NODE PATTERNS (MANDATORY)
   Task nodes support three patterns — ALL require functionCode:

   A. DATA-PROCESSING task (most common)
      - inputData: receives parent's outputData (non-null)
      - functionCode: actively transforms, filters, or computes from inputData
      - outputData: shape of the return value from functionCode
      - ✅ functionCode reads inputData fields

   B. TRIGGER-STYLE task (parent completes → task fires, but ignores parent data)
      - inputData: null (does not consume parent output)
      - functionCode: uses internal logic or constants; does NOT reference inputData
      - outputData: shape of return value, OR null if function returns nothing
      - ✅ inputData: null, functionCode: "return { result: computeSomething() };"

   C. ACTION-STYLE task (performs side-effect work, returns nothing)
      - inputData: null or matches parent outputData
      - functionCode: performs the action; may or may not reference inputData
      - outputData: null (functionCode returns undefined)
      - ✅ outputData: null, functionCode: "doSideEffect(inputData.userId);"

   INVARIANT: functionCode is ALWAYS required for task nodes.
   ❌ NEVER omit functionCode even for trigger-style or action-style tasks.

   ⚠️ DECISION NODE RULE (unchanged):
   Decision nodes MUST use inputData in functionCode to derive a boolean condition.
   If inputData is non-null, functionCode MUST reference inputData fields to branch.
   ❌ Hardcoded "return true;" with non-null inputData is BANNED.

13. SERVICE NODE outputData CONTRACT (MANDATORY)
   Service nodes make HTTP API calls and return await response.json().
   functionCode is AUTO-GENERATED from data.http — NEVER include functionCode for service nodes.

   outputData declares the expected response shape and drives child task chaining:
     - outputData: null   → fire-and-forget (response ignored, no child task needed)
     - outputData: { ... } → declares the shape of response.json() that a child task will receive

   If the API response needs processing:
     ✅ Create a child task node with inputData matching the service node's outputData
     ❌ Do NOT write custom fetch code inside the service node's functionCode

   inputData contract for service nodes:
     - POST/PUT/PATCH: inputData = { ...fields used in request body } (3+ elements if arrays)
     - GET with no body/filter: inputData = null (trigger-style — does not consume parent data)
     - GET with filter param: inputData = { filterKey: "value" } (the filter field)
     - DELETE: inputData = { id: "resource-id" } (the resource to delete)
   ❌ BANNED: inputData: {} for service nodes — use null for GET-with-no-body, NOT {}

   outputData examples:
     "inputData": null, "outputData": { "userId": "user-001", "token": "abc123" }  // POST /login
     "inputData": null, "outputData": { "tasks": [{"id":"task-1","content":"Buy milk","completed":false,"date":"2026-01-01"},{"id":"task-2","content":"Read book","completed":true,"date":"2026-01-01"},{"id":"task-3","content":"Exercise","completed":false,"date":"2026-01-01"}] }  // GET /tasks (fetch all)
     "inputData": { "id": "task-001" }, "outputData": null  // DELETE /tasks/:id

   ⛔ TASK-BEFORE-SERVICE PATTERN (CRITICAL — prevents BROKEN_GROUPNODE_PIPELINES):
   When a task node immediately precedes a service node inside a GroupNode:
   The task's ONLY purpose is to PREPARE or VALIDATE the API call payload.
   The task's outputData MUST match the service's inputData keys exactly.
   DO NOT make the task accumulate/update a local data array — the service doesn't need the array.

   ❌ ANTI-PATTERN (triggers BROKEN_GROUPNODE_PIPELINES chain break):
     task "Add New Task": functionCode accumulates array → outputData={"tasks":[...updated...]}
     service "Call Add Task API": inputData={"content":"Buy milk","date":"2026-01-04"}
     → MISMATCH: service needs {"content","date"} but task outputs {"tasks"}

   ✅ CORRECT PATTERN:
     task "Prepare Add Task": validates new task fields → outputData={"content":"Buy milk","date":"2026-01-04"}
     service "Call Add Task API": inputData={"content":"Buy milk","date":"2026-01-04"} (SAME KEYS as task output)

   RULE: task.outputData keys MUST equal service.inputData keys when they are adjacent in a pipeline.

   ⛔ CRUD OPERATION TASK PATTERN (CRITICAL — prevents input_boundary + functionCode Mismatch):
   When a GroupNode performs CRUD operations (Add/Create/Edit/Update/Delete/Remove/Complete/Mark) on a list:
   The FIRST task node's inputData MUST match the GroupNode's inputData (the list from parent output).
   → The first task's functionCode MUST DERIVE operation fields FROM the inputData array — NOT from non-existent user-input fields.

   ❌ ANTI-PATTERN (triggers input_boundary + functionCode Mismatch):
     GroupNode "Add Task": inputData={"tasks":[...]}  (from parent output)
     first task "Create New Task": inputData=null, functionCode uses inputData.newTaskContent, inputData.newTaskDate
     → WRONG: newTaskContent/newTaskDate do not exist in {tasks} — violates input_boundary AND functionCode Mismatch

   ✅ CORRECT PATTERN — first task must mirror GroupNode.inputData and derive from the array:
     GroupNode "Add Task": inputData={"tasks":[...]}
     first task "Prepare Add Task": inputData={"tasks":[...]}, outputData={"content":"Buy milk","date":"2026-01-04"}
       functionCode: "return { content: 'New Task', date: new Date().toISOString().split('T')[0] };"
       (hardcoded new-item data — does NOT reference inputData.tasks since it's a new item)

     GroupNode "Edit Task": inputData={"tasks":[...]}
     first task "Prepare Edit Task": inputData={"tasks":[...]}, outputData={"taskId":"task-1","content":"Updated"}
       functionCode: "return { taskId: inputData.tasks[0].id, content: 'Updated Task' };"
       (derives taskId FROM inputData.tasks[0].id — reads from the array)

     GroupNode "Delete Task": inputData={"tasks":[...]}
     first task "Prepare Delete Task": inputData={"tasks":[...]}, outputData={"taskId":"task-1"}
       functionCode: "return { taskId: inputData.tasks[0].id };"

   RULE: The first child task's inputData keys MUST match the GroupNode's inputData keys exactly.
   RULE: Reference inputData.tasks[0].id (or similar) to derive operation fields — NEVER reference inputData.taskId, inputData.newTaskContent, or other non-existent keys.

   ⛔ USER INPUT CAPTURE PATTERN (CRITICAL — prevents functionCode Mismatch for input forms):
   When a GroupNode captures user input (energy score, search query, form field, etc.) that does NOT exist in the GroupNode's inputData:
   The FIRST task node must OUTPUT that new field as a hardcoded example value. It MUST NOT try to READ the new field from inputData (it doesn't exist yet).

   ❌ ANTI-PATTERN (triggers functionCode Mismatch — energyScore not in inputData):
     GroupNode "Energy Score Input": inputData={"tasks":[...]}
     first task "Validate Energy Score": inputData={"tasks":[...]}, functionCode: "return { isValid: inputData.energyScore >= 0 };"
     → WRONG: inputData.energyScore does not exist — there is no energyScore in {"tasks":[...]}

   ✅ CORRECT PATTERN — CAPTURE task creates the new field, VALIDATE task consumes it:
     GroupNode "Energy Score Input": inputData={"tasks":[...]}
     task 1 "Input Energy Score": inputData={"tasks":[...]}, outputData={"tasks":[...],"energyScore":5}
       functionCode: "return { ...inputData, energyScore: 5 };"
       (hardcoded sample value represents user-provided input — does NOT read energyScore from inputData)
     task 2 "Validate Energy Score": inputData={"tasks":[...],"energyScore":5} (from task 1 output)
       outputData={"tasks":[...],"energyScore":5,"isValid":true}
       functionCode: "const isValid = inputData.energyScore >= 0 && inputData.energyScore <= 100; return { ...inputData, isValid };"
       (now inputData.energyScore EXISTS because task 1 added it)

   RULE: Every field referenced in functionCode (e.g. inputData.X) MUST exist in the node's inputData.
   RULE: If X is not in inputData, NEVER write inputData.X. Instead, have a prior node OUTPUT X first.

14. TASK NODE EXISTENCE CONTRACT (MANDATORY)
   Before creating ANY task node, verify it has a real reason to exist.

   ❌ DO NOT CREATE a task node if ANY of these are true:

   a) You cannot write a non-trivial functionCode for it
      → A node without real logic must not exist — DELETE it or merge into parent/child

   b) inputData and outputData are structurally identical
      (same top-level keys AND same sample values — deepEqual)
      → The node forwards data unchanged with zero computation
      → DELETE it. Make the parent output exactly what the next node needs.

   c) functionCode would only be "return inputData;"
      → This is a trivial passthrough with no value — DELETE the node.

   SELF-CHECK (MANDATORY before output):
   For each task node you are about to generate:
   → "What does this node actually DO to the data?"
   → If the answer is "nothing" or "pass through unchanged" → DELETE the node
   → If you cannot write a functionCode body with real logic → DELETE the node
`;

/**
 * Generation-specific examples
 */
const GENERATION_EXAMPLES = `
═══════════════════════════════════════════════════════════════
EXAMPLE OUTPUTS (JSON)
NOTE: ports/assignee/estimatedTime/metadata omitted for brevity — always include them in your output.
═══════════════════════════════════════════════════════════════

User: "Create a document review process where if approved it goes to shipping, otherwise back to draft."

{
  "nodes": [
    { "id": "node-task-review-001", "type": "task", "position": {"x":0,"y":0},
      "data": { "title": "Review Document", "description": "Check for errors",
        "execution": { "config": {
          "functionCode": "return { documentId: 'DOC-001', status: 'pending_review', isApproved: true };",
          "nodeData": { "inputData": null, "outputData": { "documentId": "DOC-001", "status": "pending_review", "isApproved": true } }
        }}
      }
    },
    { "id": "node-decision-check-002", "type": "decision", "parentNode": "node-task-review-001", "position": {"x":0,"y":150},
      "data": { "title": "Approved?", "description": "Is document valid?", "condition": { "truthy": "isApproved" }, "mode": "panel" }
    },
    { "id": "node-service-ship-003", "type": "service", "parentNode": "node-decision-check-002", "position": {"x":200,"y":300},
      "data": { "branchLabel": "yes", "title": "Initiate Shipping", "description": "Call shipping API",
        "http": { "method": "POST", "endpoint": "/api/shipping", "headers": {"Content-Type":"application/json"}, "body": {"orderId":"{{inputData.orderId}}","address":"{{inputData.address}}"} },
        "execution": { "config": { "isAsync": true,
          "nodeData": { "inputData": { "orderId": "ORD-123", "address": "123 Main St" }, "outputData": { "success": true, "trackingNumber": "TRACK-456" } }
        }}
      }
    },
    { "id": "node-task-draft-004", "type": "task", "parentNode": "node-decision-check-002", "position": {"x":-200,"y":300},
      "data": { "branchLabel": "no", "title": "Return to Draft", "description": "Send back to author" }
    }
  ]
}

---------------------------------------------------------------

User: "Create a user registration feature."

{
  "nodes": [
    { "id": "node-task-init-001", "type": "task", "position": {"x":0,"y":0},
      "data": { "title": "Initialize Registration", "description": "Set up registration context",
        "execution": { "config": {
          "functionCode": "return { email: 'user@example.com', password: 'Pass123!', username: 'john_doe' };",
          "nodeData": { "inputData": null, "outputData": { "email": "user@example.com", "password": "Pass123!", "username": "john_doe" } }
        }}
      }
    },
    { "id": "node-group-register-002", "type": "group", "parentNode": "node-task-init-001", "position": {"x":0,"y":150},
      "data": { "title": "Register User Feature", "description": "Validate input, call API, and process response", "groups": [], "collapsed": true,
        "execution": { "config": {
          "initFunctionCode": "return inputData;",
          "functionCode": "return inputData;",
          "nodeData": {
            "inputData": { "email": "user@example.com", "password": "Pass123!", "username": "john_doe" },
            "outputData": { "userId": "user-001", "token": "jwt-token-abc" }
          }
        }}
      }
    },
    { "id": "node-task-validate-003", "type": "task", "parentNode": "node-group-register-002", "position": {"x":0,"y":300},
      "data": { "title": "Validate Registration Input", "description": "Check email format and password strength",
        "execution": { "config": {
          "functionCode": "const emailValid = inputData.email.includes('@'); const passValid = inputData.password.length >= 8; return { email: inputData.email, password: inputData.password, username: inputData.username, isValid: emailValid && passValid };",
          "nodeData": {
            "inputData": { "email": "user@example.com", "password": "Pass123!", "username": "john_doe" },
            "outputData": { "email": "user@example.com", "password": "Pass123!", "username": "john_doe", "isValid": true }
          }
        }}
      }
    },
    { "id": "node-service-register-004", "type": "service", "parentNode": "node-group-register-002", "position": {"x":0,"y":450},
      "data": { "title": "Call Register API", "description": "POST /api/users to create account",
        "http": { "method": "POST", "endpoint": "/api/users", "headers": {"Content-Type":"application/json"}, "body": {"email":"{{inputData.email}}","password":"{{inputData.password}}","username":"{{inputData.username}}"} },
        "execution": { "config": { "isAsync": true,
          "nodeData": {
            "inputData": { "email": "user@example.com", "password": "Pass123!", "username": "john_doe", "isValid": true },
            "outputData": { "userId": "user-001", "token": "jwt-token-abc" }
          }
        }}
      }
    }
  ]
}

KEY RULES DEMONSTRATED:
- GroupNode.inputData = parent outputData ✅
- groups[0].inputData = GroupNode.inputData ✅
- groups[1].inputData = groups[0].outputData ✅
- GroupNode.outputData = lastChild.outputData ✅
- Service node has NO functionCode (auto-generated) ✅
- initFunctionCode is ALWAYS "return inputData;" ✅

---------------------------------------------------------------

⚠️ MULTI-FEATURE EXAMPLE — ALL GroupNodes as SIBLINGS under ONE root task.
This is the MANDATORY pattern for any app with 2+ features.

User: "Create a daily focus app with date display, task list, and energy score features."

{
  "nodes": [
    // ROOT TASK (no parentNode)
    { "id": "node-task-root-001", "type": "task", "position": {"x":0,"y":0},
      "data": { "title": "Daily Focus App", "description": "Initialize app state",
        "execution": { "config": {
          "functionCode": "return { currentDate: '2026-01-15', tasks: [{id:'t1',content:'Buy groceries',completed:false},{id:'t2',content:'Read book',completed:true},{id:'t3',content:'Exercise',completed:false}] };",
          "nodeData": { "inputData": null, "outputData": { "currentDate": "2026-01-15", "tasks": [{"id":"t1","content":"Buy groceries","completed":false},{"id":"t2","content":"Read book","completed":true},{"id":"t3","content":"Exercise","completed":false}] } }
        }}
      }
    },

    // FEATURE 1: Display Date — parentNode = ROOT TASK
    { "id": "node-group-display-date-002", "type": "group", "parentNode": "node-task-root-001", "position": {"x":-300,"y":200},
      "data": { "title": "Display Date", "description": "Show current date to user", "groups": [], "collapsed": true,
        "execution": { "config": { "initFunctionCode": "return inputData;", "functionCode": "return inputData;",
          "nodeData": { "inputData": { "currentDate": "2026-01-15" }, "outputData": { "formattedDate": "Wednesday, Jan 15 2026", "label": "Today" } }
        }}
      }
    },
    { "id": "node-task-format-date-003", "type": "task", "parentNode": "node-group-display-date-002", "position": {"x":-300,"y":350},
      "data": { "title": "Format Date", "description": "Format ISO date to readable string",
        "execution": { "config": {
          "functionCode": "const d = new Date(inputData.currentDate); return { formattedDate: d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'}) };",
          "nodeData": { "inputData": { "currentDate": "2026-01-15" }, "outputData": { "formattedDate": "Wednesday, Jan 15 2026" } }
        }}
      }
    },
    { "id": "node-task-display-date-004", "type": "task", "parentNode": "node-group-display-date-002", "position": {"x":-300,"y":500},
      "data": { "title": "Render Date UI", "description": "Add label to formatted date",
        "execution": { "config": {
          "functionCode": "return { formattedDate: inputData.formattedDate, label: 'Today' };",
          "nodeData": { "inputData": { "formattedDate": "Wednesday, Jan 15 2026" }, "outputData": { "formattedDate": "Wednesday, Jan 15 2026", "label": "Today" } }
        }}
      }
    },

    // FEATURE 2: Task List — parentNode = ROOT TASK ← SAME as Feature 1!
    { "id": "node-group-task-list-005", "type": "group", "parentNode": "node-task-root-001", "position": {"x":0,"y":200},
      "data": { "title": "Task List", "description": "Display and manage daily tasks", "groups": [], "collapsed": true,
        "execution": { "config": { "initFunctionCode": "return inputData;", "functionCode": "return inputData;",
          "nodeData": { "inputData": { "tasks": [{"id":"t1","content":"Buy groceries","completed":false},{"id":"t2","content":"Read book","completed":true},{"id":"t3","content":"Exercise","completed":false}] }, "outputData": { "displayedTasks": [{"id":"t1","content":"Buy groceries","completed":false,"label":"Buy groceries"},{"id":"t3","content":"Exercise","completed":false,"label":"Exercise"}] } }
        }}
      }
    },
    { "id": "node-task-filter-tasks-006", "type": "task", "parentNode": "node-group-task-list-005", "position": {"x":0,"y":350},
      "data": { "title": "Filter Active Tasks", "description": "Filter incomplete tasks",
        "execution": { "config": {
          "functionCode": "const active = inputData.tasks.filter(t => !t.completed); return { activeTasks: active, total: inputData.tasks.length };",
          "nodeData": { "inputData": { "tasks": [{"id":"t1","content":"Buy groceries","completed":false},{"id":"t2","content":"Read book","completed":true},{"id":"t3","content":"Exercise","completed":false}] }, "outputData": { "activeTasks": [{"id":"t1","content":"Buy groceries","completed":false},{"id":"t3","content":"Exercise","completed":false}], "total": 3 } }
        }}
      }
    },
    { "id": "node-task-display-tasks-007", "type": "task", "parentNode": "node-group-task-list-005", "position": {"x":0,"y":500},
      "data": { "title": "Prepare Task Display", "description": "Add label metadata to tasks",
        "execution": { "config": {
          "functionCode": "return { displayedTasks: inputData.activeTasks.map(t => ({...t, label: t.content})) };",
          "nodeData": { "inputData": { "activeTasks": [{"id":"t1","content":"Buy groceries","completed":false},{"id":"t3","content":"Exercise","completed":false}], "total": 3 }, "outputData": { "displayedTasks": [{"id":"t1","content":"Buy groceries","completed":false,"label":"Buy groceries"},{"id":"t3","content":"Exercise","completed":false,"label":"Exercise"}] } }
        }}
      }
    },

    // FEATURE 3: Energy Score — parentNode = ROOT TASK ← SAME as Features 1 and 2!
    { "id": "node-group-energy-score-008", "type": "group", "parentNode": "node-task-root-001", "position": {"x":300,"y":200},
      "data": { "title": "Energy Score", "description": "Calculate and display user energy score", "groups": [], "collapsed": true,
        "execution": { "config": { "initFunctionCode": "return inputData;", "functionCode": "return inputData;",
          "nodeData": { "inputData": null, "outputData": { "score": 75, "label": "Good", "message": "Energy score: 75/100" } }
        }}
      }
    },
    { "id": "node-task-calc-energy-009", "type": "task", "parentNode": "node-group-energy-score-008", "position": {"x":300,"y":350},
      "data": { "title": "Calculate Energy Score", "description": "Compute energy score from internal state",
        "execution": { "config": {
          "functionCode": "const score = Math.floor(Math.random() * 40) + 60; const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Low'; return { score, label };",
          "nodeData": { "inputData": null, "outputData": { "score": 75, "label": "Good" } }
        }}
      }
    },
    { "id": "node-task-display-energy-010", "type": "task", "parentNode": "node-group-energy-score-008", "position": {"x":300,"y":500},
      "data": { "title": "Format Energy Message", "description": "Format score into display message",
        "execution": { "config": {
          "functionCode": "return { score: inputData.score, label: inputData.label, message: \`Energy score: \${inputData.score}/100\` };",
          "nodeData": { "inputData": { "score": 75, "label": "Good" }, "outputData": { "score": 75, "label": "Good", "message": "Energy score: 75/100" } }
        }}
      }
    }
  ]
}

CRITICAL RULES DEMONSTRATED:
- ALL 3 GroupNodes share parentNode = "node-task-root-001" ✅  ← NEVER chain GroupNodes sequentially
- Energy Score group: inputData=null (trigger-style, generates data internally) ✅
- Each GroupNode has exactly 2 task children ✅
- GroupNode.outputData = lastChild.outputData (exact copy) ✅
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ MANDATORY PRE-OUTPUT CHECKS (verify EVERY node before outputting)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run these 5 checks on your complete node list before outputting:

CHECK 1 — parentNode Integrity (prevents INVALID_PARENT_REFERENCES):
  For every non-root node, confirm its parentNode value appears as an id in your list.
  ❌ If ANY parentNode does not match an existing id → fix it before outputting.
  ❌ Do NOT reference ids from other pages or invented ids.

CHECK 1b — No Sequential Feature Chains (prevents PARENT_CHILD_DATA_FLOW):
  List all feature GroupNodes. Check: do any of them have parentNode = another non-root task node?
  ❌ WRONG: GroupNode.parentNode = "node-task-add-new-task" (an intermediate task) — sequential chain!
  ✅ CORRECT: GroupNode.parentNode = "node-task-root-001" (the shared root task) — sibling!
  Every feature GroupNode MUST share the SAME parentNode (the root task).

CHECK 1c — GroupNode Min Children (prevents GROUP_NODE_MIN_CHILDREN):
  For EVERY GroupNode, count its direct children (nodes whose parentNode = this GroupNode's id).
  ❌ If ANY GroupNode has 0 or 1 children → FATAL ERROR — add more children before outputting.
  MINIMUM: 2 children per GroupNode. TYPICAL pattern: TaskNode(prepare) + ServiceNode(call API).
  ❌ Empty group with 0 children → add BOTH a prepare task AND a service/action task.
  ❌ Group with 1 child → add a 2nd child that chains from the existing child's outputData.
  ✅ Check: count children for each group ID before outputting. If count < 2 → not done yet.

CHECK 2 — functionCode Required (prevents FUNCTION_CODE_REQUIRED):
  For every task node: confirm execution.config.functionCode is present and non-empty.
  ❌ Missing functionCode → add real logic or DELETE the node.
  ❌ "return inputData;" → DELETE the node (trivial passthrough).
  ❌ inputData keys == outputData keys with same values → DELETE (trivial passthrough).
  ⚠️ There is NO valid task node without functionCode. It is always required.
  ⚠️ If you cannot write non-trivial logic for a node, DELETE it — do not generate it.

CHECK 3 — GroupNode Pipeline Integrity (prevents BROKEN_GROUPNODE_PIPELINES):
  For each GroupNode with 2+ children (sorted by y-position):
    child[0].inputData keys MUST MATCH GroupNode.inputData keys.
    child[i].inputData keys (i≥1) MUST MATCH child[i-1].outputData keys.
    GroupNode.outputData keys MUST MATCH lastChild.outputData keys.
  ❌ Key mismatch at any step → fix the functionCode/inputData/outputData before outputting.
  ⚠️ TASK→SERVICE ANTI-PATTERN (most common mismatch):
    ❌ WRONG: "Mark Task"(task) outputs {updatedTasks:[...]} → "Update Task API"(service) needs {taskId}
       The task output does NOT match what the service expects. This will fail validation.
    ✅ FIX: "Mark Task" should output EXACTLY what the service needs: {taskId, completed}
       functionCode: "return { taskId: inputData.tasks[0].id, completed: true };"
    Rule: A task node BEFORE a service node must output exactly the service's inputData keys.

CHECK 3b — No GroupNode nesting (prevents BROKEN_GROUPNODE_PIPELINES):
  Scan every node where parentNode = a GroupNode's id.
  ALL such children MUST have type "task", "service", or "decision" — NEVER "group".
  ❌ If ANY child of a GroupNode has type "group" → it is a nested feature GroupNode.
     Fix: change its parentNode to the root task node ID (make it a sibling of the parent GroupNode).
  SELF-CHECK: List all GroupNodes. For each, list its children. If ANY child is type "group" → FATAL ERROR.

CHECK 4 — No empty shapes (prevents EMPTY_DATA_SHAPE):
  The validator requires EXACTLY 3+ elements in every array. 1 or 2 elements ALSO fail.
  For every node's inputData and outputData:
  ❌ {} → replace with null or add ≥1 real key-value pair
  ❌ [] → add ≥3 representative elements
  ❌ [x] → 1 element is NOT enough — add 2 more (total ≥3)
  ❌ [x,y] → 2 elements are NOT enough — add 1 more (total ≥3)
  ❌ [{},{}] or [{},{},{}] → add real fields to each element
  ✅ tasks: [{id:"t1",content:"Buy milk",completed:false,date:"2026-01-01"},{id:"t2",content:"Write code",completed:true,date:"2026-01-01"},{id:"t3",content:"Exercise",completed:false,date:"2026-01-01"}]
  ✅ Service node GET with no body params → inputData: null (not {})

  ⛔ FILTER/DELETE NODES — outputData array shrinks, so inputData must be larger:
  When functionCode uses .filter() or removes items (e.g., delete task by ID):
    inputData array MUST have 4+ elements so outputData after deletion still has 3+.
    ❌ WRONG: inputData.tasks = [t1,t2,t3] → filter removes 1 → outputData.tasks = [t2,t3] (2 elements, FAILS)
    ✅ CORRECT: inputData.tasks = [t1,t2,t3,t4] → filter removes 1 → outputData.tasks = [t2,t3,t4] (3 elements, passes)
`;

export const GENERATION_PROMPT_CONTENT = `
${CORE_NODE_TYPES}

${FORBIDDEN_EMPTY_CONVERSION_RULES}

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
  prompt: GenerateWorkflowActionParams['prompt'],
  prdText?: string,
): string {
  let content = `Create a workflow based on this request: "${prompt}"\n\n`;

  // Add PRD context if provided
  if (prdText) {
    content += `${buildPRDContext(prdText)}\n\n`;
    content += `IMPORTANT: Reference specific PRD sections in prdReference field for every node.\n\n`;
  }

  content += `Remember: No Start/End nodes, No Edges. Use parentNode logic. Return your response as a JSON object.`;

  return content;
}
