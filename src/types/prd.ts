/**
 * PRD (Product Requirements Document) related type definitions
 */

/**
 * PRD Reference metadata for nodes
 * Links node implementation to specific PRD requirements
 */
export type PRDReference = {
  /** Section title from PRD text */
  section: string;
  /** Extracted requirement text from PRD */
  requirement: string;
  /** Rationale for why this node implements this requirement */
  rationale: string;
};

/**
 * Test case definition for node validation
 * Each node should have minimum 3 test cases
 */
export type TestCase = {
  /** Unique test case identifier */
  id: string;
  /** Test case name */
  name: string;
  /** Detailed description of what this test validates */
  description: string;
  /** Input data for the test */
  inputData: unknown;
  /** Expected output after execution */
  expectedOutput: unknown;
  /** Test execution status */
  status?: "pending" | "running" | "passed" | "failed";
  /** Error message if test failed */
  error?: string;
  /** Timestamp of last test run */
  lastRun?: number;
};

// /**
//  * Node library category for auto-categorization
//  */
// export type NodeCategory =
//   | "validation"
//   | "api"
//   | "data-processing"
//   | "authentication"
//   | "notification"
//   | "payment"
//   | "database"
//   | "custom";

// /**
//  * Reusable node template stored in library
//  * Auto-extracted from generated workflows
//  */
// export type ReusableNodeTemplate = {
//   /** Unique template identifier */
//   id: string;
//   /** Auto-detected category */
//   category: NodeCategory;
//   /** Template name */
//   name: string;
//   /** Template description */
//   description: string;
//   /** Node type */
//   nodeType: WorkflowNodeType;
//   /** Node template (without id and position) */
//   template: Omit<WorkflowNode, "id" | "position">;
//   /** Number of times this template has been used */
//   usageCount: number;
//   /** Timestamp when template was created */
//   createdAt: number;
//   /** Keywords extracted from node for search */
//   tags: string[];
// };
