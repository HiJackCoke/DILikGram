import { WorkflowNode } from "@/types";

export type GroupDataFlowProps = {
  rootInputData: unknown;
  internalNodes?: WorkflowNode[];
  onReorder?: (updatedItems: WorkflowNode[]) => void;
  onRemove?: (updatedItems: WorkflowNode[]) => void;
  onInternalNodePropertiesSave?: (
    targetId: string,
    updatedItems: WorkflowNode[],
  ) => void;
  onInternalNodeConfigSave?: (
    targetId: string,
    updatedItems: WorkflowNode[],
  ) => void;
};
