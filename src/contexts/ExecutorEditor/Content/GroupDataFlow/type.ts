import { WorkflowNode } from "@/types";

export type GroupDataFlowProps = {
  internalNodes?: WorkflowNode[];
  onReorder?: (updatedItems: WorkflowNode[]) => void;
  onRemove?: (updatedItems: WorkflowNode[]) => void;
  onInternalNodePropertiesSave?: (
    targetIte: string,
    updatedItems: WorkflowNode[],
  ) => void;
};
