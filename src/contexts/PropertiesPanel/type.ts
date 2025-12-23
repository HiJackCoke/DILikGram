import type { WorkflowNode } from "@/types/nodes";

export interface PropertiesPanelCallbacks {
  onSave?: (nodeId: string, data: Partial<WorkflowNode["data"]>) => void;
  onDelete?: (nodeId: string) => void;
}

export interface PropertiesPanelState {
  nodeId: string;
  node: WorkflowNode;
}

export type PropertiesOnSave = (
  nodeId: string,
  data: Partial<WorkflowNode["data"]>
) => void;

export type PropertiesOnDelete = (nodeId: string) => void;

export interface PropertiesPanelHandlers {
  onSave?: PropertiesOnSave;
  onDelete?: PropertiesOnDelete;
}
