import type { ReactNode } from "react";
import type { Node, NodeProps, Position } from "react-cosmos-diagram";

export type NodePort = {
  id: string;
  position: Position;
  type: "target" | "source";
  label?: string;
};

export type NodeStatus = "idle" | "running" | "completed" | "error";

export type BaseNodeData = {
  icon?: ReactNode;
  title: string;
  description?: string;
  ports?: NodePort[];
  status?: NodeStatus;
  children?: ReactNode;
};

export type StartNodeData = {
  title?: string;
  ports?: NodePort[];
};

export type StartNodeProps = NodeProps<StartNodeData>;

export type EndNodeStatus = "success" | "failure" | "neutral";

export type EndNodeData = {
  title?: string;
  status?: EndNodeStatus;
  ports?: NodePort[];
};

export type EndNodeProps = NodeProps<EndNodeData>;

export type TaskNodeData = BaseNodeData & {
  assignee?: string;
  estimatedTime?: number;
  metadata?: Record<string, string>;
};

export type TaskNodeProps = NodeProps<TaskNodeData>;

export type WorkflowNodeType = "start" | "end" | "task";

export type WorkflowNode = Node<
  StartNodeData | EndNodeData | TaskNodeData,
  WorkflowNodeType
>;
