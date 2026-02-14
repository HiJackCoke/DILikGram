import type { ExecutionConfig } from "@/types/workflow";
import type { WorkflowNodeType, WorkflowNode } from "@/types/nodes";

export interface ExecutorEditorState {
  nodeId: string;
  nodeType: WorkflowNodeType;
  config?: ExecutionConfig;
  internalNodes?: WorkflowNode[]; // For group nodes
}

export type ExecutorOnSave = (
  nodeId: string,
  config: ExecutionConfig,
  internalNodes?: WorkflowNode[],
) => void;

export type ExecutorOnInternalNodesChange = (
  nodeId: string,
  internalNodes: WorkflowNode[],
) => void;
