import { Position } from "react-cosmos-diagram";
import type { NodePort, WorkflowNodeType } from "@/types/nodes";

/**
 * Generate port ID from label (kebab-case)
 */
export function generatePortId(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // spaces → underscores
    .replace(/[^a-z0-9_]/g, "") // remove special chars
    .substring(0, 20); // max 20 chars
}

/**
 * Assign position based on port type and index
 */
export function assignPosition(
  type: "target" | "source",
  index: number,
  nodeType: WorkflowNodeType
): Position {
  if (type === "target") {
    return Position.Top;
  }

  // Source ports
  if (nodeType === "decision") {
    const positions = [Position.Right, Position.Bottom];
    return positions[index] || Position.Right;
  }

  return Position.Bottom;
}

/**
 * Get port limits for a node type
 */
export function getPortLimits(nodeType: WorkflowNodeType): {
  maxTarget: number;
  maxSource: number;
} {
  switch (nodeType) {
    case "start":
      return { maxTarget: 0, maxSource: 1 };
    case "end":
      return { maxTarget: 1, maxSource: 0 };
    case "decision":
      return { maxTarget: 1, maxSource: 2 };
    case "task":
    case "service":
      return { maxTarget: 1, maxSource: 1 };
    default:
      return { maxTarget: 1, maxSource: 1 };
  }
}

/**
 * Validate ports against node type constraints
 */
export function validatePorts(
  ports: NodePort[],
  nodeType: WorkflowNodeType
): { valid: boolean; error?: string } {
  const limits = getPortLimits(nodeType);

  const targetCount = ports.filter((p) => p.type === "target").length;
  const sourceCount = ports.filter((p) => p.type === "source").length;

  if (targetCount > limits.maxTarget) {
    return {
      valid: false,
      error: `Target ports exceed limit (max ${limits.maxTarget})`,
    };
  }

  if (sourceCount > limits.maxSource) {
    return {
      valid: false,
      error: `Source ports exceed limit (max ${limits.maxSource})`,
    };
  }

  // Check for empty labels
  const hasEmptyLabel = ports.some((p) => p.label && !p.label.trim());
  if (hasEmptyLabel) {
    return {
      valid: false,
      error: "Port labels cannot be empty",
    };
  }

  // Check for duplicate labels (case-insensitive)
  const labels = ports
    .map((p) => (p.label || "").toLowerCase().trim())
    .filter(Boolean);
  const hasDuplicates = labels.length !== new Set(labels).size;
  if (hasDuplicates) {
    return {
      valid: false,
      error: "Duplicate port labels not allowed",
    };
  }

  return { valid: true };
}
