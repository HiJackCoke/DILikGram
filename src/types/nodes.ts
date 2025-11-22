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

export type DecisionNodeData = {
  title: string;
  condition?: string;
  ports?: NodePort[];
};

export type DecisionNodeProps = NodeProps<DecisionNodeData>;

export type ServiceType = "api" | "database" | "email" | "webhook" | "custom";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ServiceNodeData = BaseNodeData & {
  serviceType?: ServiceType;
  method?: HttpMethod;
  endpoint?: string;
};

export type ServiceNodeProps = NodeProps<ServiceNodeData>;

export type WorkflowNodeType =
  | "start"
  | "end"
  | "task"
  | "decision"
  | "service";

export type WorkflowNode = Node<
  | StartNodeData
  | EndNodeData
  | TaskNodeData
  | DecisionNodeData
  | ServiceNodeData,
  WorkflowNodeType
>;
