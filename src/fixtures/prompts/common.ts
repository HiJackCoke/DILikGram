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
         - **CRITICAL**: Receives \`inputData\` (output from parent node) and \`fetch\` as parameters
         - **EXCEPTION**: If parent is a START NODE, inputData will be NULL
           - ❌ Wrong (start child): \`return inputData.tasks.length;\`
           - ✅ Correct (start child): \`return [];\` // initialize data from scratch
         - ALL data MUST be accessed via \`inputData.<field>\` — NEVER reference fields directly
         - ❌ Wrong: \`return tasks.length <= maxTasks\`
         - ✅ Correct: \`return inputData.tasks.length <= maxTasks\`
         - **CRITICAL SCOPE RULE**: functionCode has ONLY 2 variables available:
           1. \`inputData\` - Data from parent node's output
           2. \`fetch\` - Global fetch API for external calls
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
       - \`config.nodeData.inputData\`: input parameters sample
       - \`config.nodeData.outputData\`: output result sample
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
     - \`http\`: object (Required if serviceType="api", Default: { method: "GET", endpoint: "", body: {}, headers: {} })
     - **CRITICAL**: For all HTTP endpoints, ALWAYS use \`serviceType: "api"\`
     - \`http\`: object (**REQUIRED** for ALL serviceTypes)
       - \`method\`: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" (REQUIRED)
       - \`endpoint\`: string (e.g. "/api/users", "/api/meals/{id}") (REQUIRED)
       
     - \`execution\`: object (**REQUIRED**)
       - \`config.nodeData.isAsync\`: true
       - \`config.functionCode\`: async API call logic (function body only, no "async function" wrapper)
         - **CRITICAL**: Receives \`inputData\` (upstream data) and \`fetch\` as parameters
         - ALL data MUST be accessed via \`inputData.<field>\` — NEVER reference fields directly
         - ❌ Wrong: \`userId\`, \`email\`, \`endpoint\`
         - ✅ Correct: \`inputData.userId\`, \`inputData.email\`, \`inputData.endpoint\`
         - **CRITICAL SCOPE RULE**: functionCode has ONLY 2 variables available:
           1. \`inputData\` - Data from parent node's output
           2. \`fetch\` - Global fetch API for external calls
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
         - ❌ Wrong (result discarded, no return): \`await fetch(endpoint, options);\`
         - ✅ Correct (return the API response): \`const res = await fetch(endpoint, options); return await res.json();\`
       - \`config.nodeData.inputData\`: request body/query params sample
       - \`config.nodeData.outputData\`: API response structure sample
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
       - \`config.functionCode\`: business logic implementation (function body only, no "function" wrapper), MUST return a \`boolean\` value.
         - **CRITICAL**: Receives \`inputData\` (output from parent node) and \`fetch\` as parameters
         - ALL data MUST be accessed via \`inputData.<field>\` — NEVER reference fields directly
         - ❌ Wrong: \`return status === 'active'\`
         - ✅ Correct: \`return inputData.status === 'active'\`
       - \`config.nodeData.inputData\`: input parameters sample
       - \`config.nodeData.outputData\`: output result sample
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
`;

export const PARENT_CHILD_RULES = `
═══════════════════════════════════════════════════════════════
🔗 PARENT-CHILD CONNECTION RULES (ABSOLUTE)
═══════════════════════════════════════════════════════════════

1. **ParentNode Mandatory Reference**
   - Every node you create must refer to a \`parentNode\`.
   - The \`parentNode\` must be the \`id\` of another node in the workflow.
   - **Exception**: In a fresh Generation, the very first node (root) may omit \`parentNode\`.

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
`;

export const COMMON_VALIDATION_RULES = `
VALIDATION CHECKLIST (Self-Correction):

□ **Correct ID Format?** (node-\${type}-\${uuid}) // uuid format: [8-4-4-4-12 char]
□ **No "edges" field?** (System handles edges)
□ **No "start" or "end" nodes?** (System handles them)
□ **All nodes have valid \`parentNode\`?** (Except the root of a new flow)
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
□ **Execution Config Check:**
   - Do Task nodes have \`execution.config.functionCode\`?
   - Do Service nodes have \`execution.config.functionCode\`?
   - Are \`inputData\` and \`outputData\` samples provided?
   - Is \`functionCode\` written as function body only (no "function" or "async function" wrapper)?
   - Does \`functionCode\` end with a \`return\` statement? (Task/Service: MUST return outputData object; Decision: MUST return boolean)
□ **inputData Reference Check:**
   - Does \`functionCode\` use \`inputData.<field>\` (not bare variable names)?
   - ❌ Wrong: \`tasks.length\`, \`userId\`, \`email\`, \`endpoint\`
   - ✅ Correct: \`inputData.tasks.length\`, \`inputData.userId\`, \`inputData.email\`
□ **Execution Scope Check:**
   - Does functionCode ONLY use \`inputData\` and \`fetch\`?
   - Does functionCode avoid referencing \`metadata\`, \`node\`, \`config\`, or other external variables?
   - ❌ FORBIDDEN: \`metadata.maxTasks\`, \`node.data.title\`, \`config.timeout\`, \`this.value\`
   - ✅ REQUIRED: \`inputData.maxTasks\`, \`inputData.title\`, \`inputData.timeout\`
   - If config values are needed, include them in \`inputData\` schema
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
`;

export const TECHNICAL_SPECIFICATION_RULES = `
═══════════════════════════════════════════════════════════════
🛠️ FULL-STACK TECHNICAL SPECIFICATION RULES (DEV-READY)
═══════════════════════════════════════════════════════════════

1. **Task Node Metadata Mapping**:
   - DO NOT use lists in \`description\`. Move all sub-features to \`data.metadata\`.
   - Each key in \`metadata\` should represent a specific requirement or variable.

2 .**Service Node: Standardized Function Template** (MANDATORY):
   Every Service Node's \`description\` or a dedicated \`functionCode\` field must follow this template:
   \`\`\`javascript
   const headers = { "Content-Type": "application/json" };
   const body = { /* use inputData.<field> for values, e.g. inputData.userId */ };
   const endpoint = inputData.endpoint || "[API_ENDPOINT]";
   const method = "[HTTP_METHOD]";

   try {
     const response = await fetch(endpoint, { method, headers, body: JSON.stringify(body) });
     if (!response.ok) throw new Error(\`HTTP Error: \${response.status}\`);
     return await response.json();
   } catch (error) {
     throw new Error(\`API Request Failed: \${error.message}\`);
   }
   \`\`\`

3. **Decision Node: Boolean Constraint**:
   - The \`functionCode\` in a Decision node MUST evaluate to or explicitly return \`true\` or \`false\`.
   - Example: \`return inputData.status === 'active';\`

4. **Sequential Flow for Roles**:
   - Start with a **Task Node (PRD)** defining requirements.
   - Follow with **Service Node (Backend)** defining the API.
   - Branch with **Decision Node (Logic/QA)** to handle Success/Error paths.
   - End with **Task Nodes (Frontend)** for UI feedback (e.g., "Show Toast Error").

5. **Atomic Logic Steps**:
   - In \`description\`, use numbered steps for execution logic.
   - Example: "1. Validate Request, 2. Database Insert, 3. Send Auth Email."

6. **Error Handling**:
   - Every "no" branch from a Decision node must lead to a specific error handling flow.

7. **Structured Collaboration Flow**:
   - **PRD (Task)**: Define "What to build" in metadata.
   - **Backend (Service)**: Define "How to fetch/save" in functionCode & schemas.
   - **QA (Decision)**: Define "What determines success" in boolean logic.
   - **Frontend (Task)**: Define "How to show" based on results.
`;
