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
     - \`serviceType\`: "api" | "database" | "email" (Default: "api")
     - \`http\`: object (Required if serviceType="api", Default: { method: "GET", endpoint: "" })
     - \`metadata\`: object (Default: {})
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
     - \`condition\`: object (Default: {})
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
     - **CRITICAL**: Must have at least two children nodes (one 'yes', one 'no').
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
   - IF a node's \`parentNode\` is **NOT** a Decision Node:
     - DO NOT include \`branchLabel\`.

3. **Decision Node Completeness**
   - Every Decision Node MUST have at least ONE child with \`branchLabel: "yes"\`.
   - Every Decision Node MUST have at least ONE child with \`branchLabel: "no"\`.
   - You cannot create a Decision Node with only one branch.

4. **No Edges, No Start/End**
   - DO NOT generate "edges" array.
   - DO NOT generate nodes of type "start" or "end".
   - Focus ONLY on the functional nodes (task, service, decision).
`;

export const COMMON_VALIDATION_RULES = `
VALIDATION CHECKLIST (Self-Correction):

□ **Correct ID Format?** (node-\${type}-\${uuid}) // uuid format: [8-4-4-4-12 char]
□ **No "edges" field?** (System handles edges)
□ **No "start" or "end" nodes?** (System handles them)
□ **All nodes have valid \`parentNode\`?** (Except the root of a new flow)
□ **Data Fields Complete?**
   - Task: title, description, assignee, estimatedTime
   - Service: title, description, serviceType, http (if api)
   - Decision: title, description, condition
□ **Decision Node Check:**
   - Does every decision node have a "yes" child?
   - Does every decision node have a "no" child?
□ **BranchLabel Check:**
   - Do children of decision nodes have \`branchLabel\` ("yes"/"no")?
   - Do children of non-decision nodes OMIT \`branchLabel\`?
`;
