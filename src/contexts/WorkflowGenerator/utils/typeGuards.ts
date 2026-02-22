/**
 * Type Guard Utilities
 *
 * Provides safe type narrowing for WorkflowNode union types
 * All functions perform runtime validation before any type assertions
 */

import type { ExecutionConfig, WorkflowNode } from "@/types";

/**
 * Safely get node title
 * Works with all node types that have a title property
 *
 * @param node - Workflow node
 * @returns Title string or "Untitled" if not available
 */
export function getNodeTitle(node: WorkflowNode): string {
  const data = node.data;

  // Runtime validation: check if data exists and has title property
  if (data && typeof data === "object" && "title" in data) {
    const title = data.title;

    // Additional validation: ensure title is actually a string
    if (typeof title === "string") {
      return title;
    }
  }

  return "Untitled";
}

/**
 * Safely get node description
 * Works with all node types that have a description property
 *
 * @param node - Workflow node
 * @returns Description string or empty string if not available
 */
export function getNodeDescription(node: WorkflowNode): string {
  const data = node.data;

  // Runtime validation: check if data exists and has description property
  if (data && typeof data === "object" && "description" in data) {
    const description = data.description;

    // Additional validation: ensure description is actually a string
    if (typeof description === "string") {
      return description;
    }
  }

  return "";
}

/**
 * Safely get groups array from GroupNode
 * Returns null if node is not a valid GroupNode
 *
 * @param node - Workflow node
 * @returns Groups array or null if not a GroupNode
 */
export function getGroups(node: WorkflowNode): WorkflowNode[] | null {
  // Type check: must be a group node
  if (node.type !== "group") {
    return null;
  }

  const data = node.data;

  // Runtime validation: check if data exists and has groups property
  if (data && typeof data === "object" && "groups" in data) {
    const groups = data.groups;

    // Additional validation: ensure groups is actually an array
    if (Array.isArray(groups)) {
      return groups;
    }
  }

  return null;
}

/**
 * Check if node has title property
 * Returns true for task, service, decision, and group nodes
 *
 * @param node - Workflow node
 * @returns True if node type supports title
 */
export function hasTitle(node: WorkflowNode): boolean {
  return (
    node.type === "task" ||
    node.type === "service" ||
    node.type === "decision" ||
    node.type === "group"
  );
}

/**
 * Check if node has description property
 * Returns true for all nodes except start/end
 *
 * @param node - Workflow node
 * @returns True if node type supports description
 */
export function hasDescription(node: WorkflowNode): boolean {
  return node.type !== "start" && node.type !== "end";
}


/**
 * Type guard to check if a value is an ExecutionConfig
 */
export function isExecutionConfig(value: unknown): value is ExecutionConfig {
  if (!value || typeof value !== "object") return false;

  // Check if it has the expected structure
  return (
    "functionCode" in value ||
    "nodeData" in value ||
    "lastModified" in value
  );
}
