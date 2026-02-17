/**
 * JSON Schema definitions for AI-generated workflows
 *
 * These schemas are used to validate and structure OpenAI responses
 */

/**
 * Schema for PRD Reference field
 */
export const PRD_REFERENCE_SCHEMA = {
  type: "object",
  required: ["section", "requirement", "rationale"],
  properties: {
    section: {
      type: "string",
      description: "Section title from PRD",
    },
    requirement: {
      type: "string",
      description: "Exact requirement text from PRD",
    },
    rationale: {
      type: "string",
      description: "Explanation of why this node implements this requirement",
    },
  },
};

/**
 * Schema for Test Case
 */
export const TEST_CASE_SCHEMA = {
  type: "object",
  required: ["id", "name", "description", "inputData", "expectedOutput"],
  properties: {
    id: {
      type: "string",
      description: "Unique test case identifier",
    },
    name: {
      type: "string",
      description: "Test case name",
    },
    description: {
      type: "string",
      description: "Detailed description of what this test validates",
    },
    inputData: {
      description: "Input data for the test",
    },
    expectedOutput: {
      description: "Expected output after execution",
    },
  },
};

/**
 * Schema for enhanced node data with PRD reference and test cases
 */
export const PRD_ENHANCED_NODE_DATA_SCHEMA = {
  type: "object",
  required: ["title"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    branchLabel: {
      type: "string",
      enum: ["yes", "no"],
      description:
        "REQUIRED when parentNode is a Decision Node. Specifies which branch (yes/no) this node belongs to. Omit for all other parents.",
    },
    prdReference: PRD_REFERENCE_SCHEMA,
    testCases: {
      type: "array",
      minItems: 3,
      items: TEST_CASE_SCHEMA,
    },
  },
};

/**
 * Schema for workflow node with PRD enhancements
 */
export const PRD_ENHANCED_NODE_SCHEMA = {
  type: "object",
  required: ["id", "type", "data", "position"],
  properties: {
    id: {
      type: "string",
      description: "Unique node identifier (format: node-{type}-{uuid})",
    },
    type: {
      type: "string",
      enum: ["task", "service", "decision", "group"],
      description: "Node type (NO start/end nodes)",
    },
    parentNode: {
      type: "string",
      description: "Parent node ID (omit for root node)",
    },
    position: {
      type: "object",
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
      },
    },
    data: PRD_ENHANCED_NODE_DATA_SCHEMA,
  },
};

/**
 * Complete schema for workflow generation response
 */
export const GENERATE_WORKFLOW_RESPONSE_SCHEMA = {
  type: "object",
  required: ["nodes", "metadata"],
  properties: {
    nodes: {
      type: "array",
      items: PRD_ENHANCED_NODE_SCHEMA,
      description: "Array of workflow nodes",
    },
    metadata: {
      type: "object",
      required: ["description", "estimatedComplexity"],
      properties: {
        description: {
          type: "string",
          description: "Description of the generated workflow",
        },
        estimatedComplexity: {
          type: "string",
          enum: ["simple", "moderate", "complex"],
        },
        prdSummary: {
          type: "string",
          description: "AI-generated summary of PRD requirements",
        },
        reusedNodes: {
          type: "array",
          items: { type: "string" },
          description: "IDs of nodes reused from library",
        },
      },
    },
  },
};
