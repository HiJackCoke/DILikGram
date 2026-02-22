/**
 * Node Library Management
 *
 * Manages reusable node templates stored in localStorage
 * Automatically categorizes and tags nodes for easy discovery
 */

import type { ReusableNodeTemplate, NodeCategory } from "@/types/prd";
import type { WorkflowNode } from "@/types/nodes";
import { getNodeTitle, getNodeDescription } from "@/contexts/WorkflowGenerator/utils/typeGuards";

const LIBRARY_STORAGE_KEY = "dilikgram:node-library";

/**
 * Load all reusable node templates from localStorage
 *
 * @returns Array of reusable node templates
 */
export function loadNodeLibrary(): ReusableNodeTemplate[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(LIBRARY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load node library:", error);
    return [];
  }
}

/**
 * Save reusable node templates to localStorage
 * Updates existing nodes or adds new ones
 *
 * @param nodes - Array of reusable node templates to save
 */
export function saveToNodeLibrary(nodes: ReusableNodeTemplate[]): void {
  if (typeof window === "undefined") return;

  try {
    const existing = loadNodeLibrary();
    const merged = [...existing];

    nodes.forEach((newNode) => {
      const existingIndex = merged.findIndex((n) => n.id === newNode.id);
      if (existingIndex >= 0) {
        // Update existing node and increment usage count
        merged[existingIndex] = {
          ...newNode,
          usageCount: merged[existingIndex].usageCount + 1,
        };
      } else {
        // Add new node
        merged.push(newNode);
      }
    });

    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error("Failed to save to node library:", error);
  }
}

/**
 * Extract reusable nodes from generated workflow
 * Filters out feature-specific nodes and identifies utility nodes
 *
 * @param nodes - Array of workflow nodes
 * @returns Array of reusable node templates
 */
export function extractReusableNodes(
  nodes: WorkflowNode[],
): ReusableNodeTemplate[] {
  return nodes
    .filter((node) => isReusableNode(node) && node.type)
    .map((node) => {
      return {
        id: node.id,
        category: categorizeNode(node),
        name: getNodeTitle(node) || node.type || "Untitled",
        description: getNodeDescription(node),
        nodeType: node.type!,
        template: {
          type: node.type!,
          data: node.data,
          parentNode: node.parentNode,
        },
        usageCount: 1,
        createdAt: Date.now(),
        tags: extractTags(node),
      };
    });
}

/**
 * Determine if a node is reusable (generic utility vs feature-specific)
 *
 * @param node - Workflow node to check
 * @returns True if node is reusable
 */
function isReusableNode(node: WorkflowNode): boolean {
  // Skip start/end nodes
  if (node.type === "start" || node.type === "end") {
    return false;
  }

  const title = getNodeTitle(node).toLowerCase();
  const description = getNodeDescription(node).toLowerCase();

  // Skip feature-specific nodes (login, signup, checkout, etc.)
  const featureKeywords = [
    "login",
    "signup",
    "sign up",
    "sign in",
    "register",
    "checkout",
    "cart",
    "order",
    "profile",
    "dashboard",
  ];

  const hasFeatureKeyword = featureKeywords.some(
    (keyword) => title.includes(keyword) || description.includes(keyword),
  );

  if (hasFeatureKeyword) {
    return false;
  }

  // Must have execution config to be useful
  const hasExecutor = !!node.data?.execution?.config;

  return hasExecutor;
}

/**
 * Auto-categorize node based on title and description
 *
 * @param node - Workflow node to categorize
 * @returns Node category
 */
export function categorizeNode(node: WorkflowNode): NodeCategory {
  const title = getNodeTitle(node).toLowerCase();
  const description = getNodeDescription(node).toLowerCase();
  const text = `${title} ${description}`;

  // Check for validation patterns
  if (
    text.includes("valid") ||
    text.includes("check") ||
    text.includes("verify")
  ) {
    return "validation";
  }

  // Check for authentication patterns
  if (
    text.includes("auth") ||
    text.includes("token") ||
    text.includes("session")
  ) {
    return "authentication";
  }

  // Check for API patterns
  if (
    node.type === "service" ||
    text.includes("api") ||
    text.includes("request") ||
    text.includes("fetch")
  ) {
    return "api";
  }

  // Check for notification patterns
  if (
    text.includes("email") ||
    text.includes("notify") ||
    text.includes("alert") ||
    text.includes("send")
  ) {
    return "notification";
  }

  // Check for payment patterns
  if (
    text.includes("payment") ||
    text.includes("pay") ||
    text.includes("charge") ||
    text.includes("invoice")
  ) {
    return "payment";
  }

  // Check for database patterns
  if (
    text.includes("database") ||
    text.includes("db") ||
    text.includes("query") ||
    text.includes("store")
  ) {
    return "database";
  }

  // Check for data processing patterns
  if (
    text.includes("transform") ||
    text.includes("format") ||
    text.includes("parse") ||
    text.includes("process")
  ) {
    return "data-processing";
  }

  return "custom";
}

/**
 * Extract searchable tags from node
 *
 * @param node - Workflow node
 * @returns Array of tags
 */
export function extractTags(node: WorkflowNode): string[] {
  const tags: string[] = [];
  const title = getNodeTitle(node).toLowerCase();
  const description = getNodeDescription(node).toLowerCase();
  const text = `${title} ${description}`;

  // Common keywords
  const keywords = [
    "email",
    "validation",
    "api",
    "auth",
    "token",
    "database",
    "payment",
    "notification",
    "transform",
    "format",
    "parse",
  ];

  keywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      tags.push(keyword);
    }
  });

  // Add node type as tag
  if (node.type) {
    tags.push(node.type);
  }

  // Remove duplicates
  return Array.from(new Set(tags));
}

/**
 * Clear entire node library
 * Useful for testing or reset
 */
export function clearNodeLibrary(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(LIBRARY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear node library:", error);
  }
}
