import type { ExecutionConfig } from "@/types/workflow";
import type { WorkflowNodeType } from "@/types/nodes";

export interface ExecutorEditorState {
  nodeId: string;
  nodeType: WorkflowNodeType;
  config?: ExecutionConfig;
}

export type ExecutorOnSave = (nodeId: string, config: ExecutionConfig)  => void;
