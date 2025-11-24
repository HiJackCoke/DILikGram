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
// export type NodeTypeKey = "start" | "end" | "task" | "decision" | "service";

// ============================================
// 노드 상태
// ============================================
export type NodeStatus = "idle" | "running" | "completed" | "error";

// ============================================
// 노드 공통 데이터 (하이라이트 상태)
// ============================================
export type NodeCommonData = {
  highlighted?: boolean; // 플로우 경로에 포함됨
  dimmed?: boolean; // 다른 플로우가 선택됨
};

// ============================================
// StartNode
// ============================================
export type StartNodeData = NodeCommonData & {
  title?: string;
  ports?: NodePort[];
};

export type StartNodeProps = NodeProps<StartNodeData>;

// ============================================
// EndNode
// ============================================
export type EndNodeStatus = "success" | "failure" | "neutral";

export type EndNodeData = NodeCommonData & {
  title?: string;
  status?: EndNodeStatus;
  ports?: NodePort[];
};

export type EndNodeProps = NodeProps<EndNodeData>;

// ============================================
// TaskNode
// ============================================
export type TaskNodeData = NodeCommonData & {
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
export type DecisionNodeData = NodeCommonData & {
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

export type ServiceNodeData = NodeCommonData & {
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
  // NodeTypeKey

  // react-cosmos-diagram에서 좀더 타입 세분화가 필요
>;
