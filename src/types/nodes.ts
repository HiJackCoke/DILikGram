import type { ReactNode } from "react";
import type { NodeProps, Position, Node } from "react-cosmos-diagram";

// ============================================
// Port 타입 정의
// ============================================
export type NodePort = {
  id: string;
  position: Position;
  type: "target" | "source";
  label?: string;
};

// ============================================
// 노드 타입 키
// ============================================
export type WorkflowNodeType =
  | "start"
  | "end"
  | "task"
  | "decision"
  | "service";

// ============================================
// 노드 상태
// ============================================
export type NodeStatus = "idle" | "running" | "completed" | "error";

// ============================================
// 노드 실행 상태
// ============================================
export type WorkflowNodeExecutionState = "idle" | "executing" | "executed";

// ============================================
// 노드 공통 데이터 (하이라이트 상태 + 실행 상태)
// ============================================
export type WorkflowNodeState = {
  highlighted?: boolean; // 플로우 경로에 포함됨
  dimmed?: boolean; // 다른 플로우가 선택됨
  executionState?: WorkflowNodeExecutionState; // 실행 상태
};

// ============================================
// StartNode
// ============================================
export type StartNodeData = WorkflowNodeState & {
  title?: string;
  ports?: NodePort[];
};

export type StartNodeProps = NodeProps<StartNodeData>;

// ============================================
// EndNode
// ============================================
export type EndNodeStatus = "success" | "failure" | "neutral";

export type EndNodeData = WorkflowNodeState & {
  title?: string;
  status?: EndNodeStatus;
  ports?: NodePort[];
};

export type EndNodeProps = NodeProps<EndNodeData>;

// ============================================
// TaskNode
// ============================================
export type TaskNodeData = WorkflowNodeState & {
  icon?: ReactNode;
  title: string;
  description?: string;
  ports?: NodePort[];
  status?: NodeStatus;
  assignee?: string;
  estimatedTime?: number;
  metadata?: Record<string, string>;
};

export type TaskNodeProps = NodeProps<TaskNodeData>;

// ============================================
// DecisionNode
// ============================================
export type DecisionNodeData = WorkflowNodeState & {
  title: string;
  condition?: string;
  ports?: NodePort[];
};

export type DecisionNodeProps = NodeProps<DecisionNodeData>;

// ============================================
// ServiceNode
// ============================================
export type ServiceType = "api" | "database" | "email" | "webhook" | "custom";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ServiceNodeData = WorkflowNodeState & {
  icon?: ReactNode;
  title: string;
  description?: string;
  ports?: NodePort[];
  status?: NodeStatus;
  serviceType?: ServiceType;
  method?: HttpMethod;
  endpoint?: string;
};

export type ServiceNodeProps = NodeProps<ServiceNodeData>;

// ============================================
// 워크플로우 노드 타입 (ReactDiagram용)
// ============================================
export type WorkflowNode = Node<
  | StartNodeData
  | EndNodeData
  | TaskNodeData
  | DecisionNodeData
  | ServiceNodeData,
  string
>;
