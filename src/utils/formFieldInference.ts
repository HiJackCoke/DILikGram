import { NODE_FIELD_DEFINITIONS } from "@/fixtures/nodes";
import type { FieldConfig } from "@/types/editor";
import type { WorkflowNodeType } from "@/types/nodes";

/**
 * Get field config for a specific node type and field key
 * This is the PRIMARY method - always try this first
 */
export function getFieldConfig(
  nodeType: WorkflowNodeType,
  key: string
): FieldConfig | null {
  const nodeFields = NODE_FIELD_DEFINITIONS[nodeType];
  if (!nodeFields) return null;
  return nodeFields[key] || null;
}
