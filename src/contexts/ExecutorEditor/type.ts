import type { ExecutionConfig } from "@/types/workflow";
import type { WorkflowNodeType, WorkflowNode } from "@/types/nodes";
import type { TestCase } from "@/types/prd";

export interface ExecutorEditorState {
  nodeId: string;
  nodeType: WorkflowNodeType;
  config?: ExecutionConfig;
  internalNodes?: WorkflowNode[]; // For group nodes
  testCases?: TestCase[];
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
