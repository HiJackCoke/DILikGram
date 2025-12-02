import type { ExecutorConfig } from "@/types/executor";
import type { WorkflowNodeType } from "@/types/nodes";

export interface ExecutorEditorState {
  nodeId: string;
  nodeType: WorkflowNodeType;
  config?: ExecutorConfig;
}

export type ExecutorOnSave = (nodeId: string, config: ExecutorConfig) => void;
