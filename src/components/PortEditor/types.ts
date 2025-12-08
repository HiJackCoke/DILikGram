import type { NodePort, WorkflowNodeType } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

export interface PortItem extends NodePort {
  connectedNodeId?: string; // Derived from edges (read-only)
}

export interface PortEditorProps {
  label: string;
  value: NodePort[];
  nodeType: WorkflowNodeType;
  edges: WorkflowEdge[];
  currentNodeId: string;
  readOnly?: boolean;
  onChange: (ports: NodePort[]) => void;
}

export interface PortEditorViewProps {
  label: string;
  targetPorts: PortItem[];
  sourcePorts: PortItem[];
  limits: { maxTarget: number; maxSource: number };
  readOnly?: boolean;
  canAddTarget: boolean;
  canAddSource: boolean;
  validationError?: string;
  onAddTarget: () => void;
  onAddSource: () => void;
  onEditLabel: (portId: string, newLabel: string) => void;
  onRemove: (portId: string) => void;
}
