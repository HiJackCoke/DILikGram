import type { WorkflowNode } from "@/types/nodes";

export interface PropertiesPanelState {
  nodeId: string;
  node: WorkflowNode;
}

export type PropertiesOnSave = (
  nodeId: string,
  data: Partial<WorkflowNode["data"]>
) => void;
