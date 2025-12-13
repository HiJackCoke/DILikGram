import type { ReactNode } from "react";
import type { NodeProps, Position, Node } from "react-cosmos-diagram";
import type { ExecutionData } from "./workflow";

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

// ============================================
// 노드 공통 데이터 (하이라이트 상태 + 실행 상태)
// ============================================
export type WorkflowNodeState = {
  highlighted?: boolean; // 플로우 경로에 포함됨
  dimmed?: boolean; // 다른 플로우가 선택됨
};

type WorkflowNodeData<T> = T & {
  state?: WorkflowNodeState;
  execution?: ExecutionData;
  ports?: NodePort[];
};

export type WorkflowNodeProps<T = unknown> = NodeProps<WorkflowNodeData<T>> & {
  type: WorkflowNodeType;
};
// ============================================
// StartNode
// ============================================
export type StartNodeData = {
  title?: string;
};

export type StartNodeProps = WorkflowNodeProps<StartNodeData>;

// ============================================
// EndNode
// ============================================
export type EndNodeStatus = "success" | "failure" | "neutral";

export type EndNodeData = {
  title?: string;
  status?: EndNodeStatus;
};

export type EndNodeProps = WorkflowNodeProps<EndNodeData>;

// ============================================
// TaskNode
// ============================================
export type TaskNodeData = {
  icon?: ReactNode;
  title: string;
  description?: string;

  status?: NodeStatus;
  assignee?: string;
  estimatedTime?: number;
  metadata?: Record<string, string>;
};

export type TaskNodeProps = WorkflowNodeProps<TaskNodeData>;

// ============================================
// DecisionNode
// ============================================
export type DecisionNodeData = {
  title: string;
  condition?: string;
  mode?: EditMode;
};

export type DecisionNodeProps = WorkflowNodeProps<DecisionNodeData>;

// ============================================
// ServiceNode
// ============================================
export type ServiceType = "api" | "database" | "email" | "webhook" | "custom";
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type EditMode = "code" | "panel";

export type HttpConfig = {
  method?: HttpMethod;
  endpoint?: string;
  headers?: HeadersInit;
  body?: Record<string, unknown>;
};

export type ServiceNodeData = {
  icon?: ReactNode;
  title: string;
  description?: string;

  status?: NodeStatus;
  serviceType?: ServiceType;
  mode?: EditMode;
  http?: HttpConfig;
  timeout?: number;
  retry?: {
    count: number;
    delay: number;
  };
};

export type ServiceNodeProps = WorkflowNodeProps<ServiceNodeData>;

export type WorkflowNodeMap = {
  start: StartNodeData;
  end: EndNodeData;
  task: TaskNodeData;
  decision: DecisionNodeData;
  service: ServiceNodeData;
};

// ============================================
// 워크플로우 노드 타입 (ReactDiagram용)
// ============================================
export type WorkflowNode = Node<
  WorkflowNodeData<
    | StartNodeData
    | EndNodeData
    | TaskNodeData
    | DecisionNodeData
    | ServiceNodeData
  >,
  WorkflowNodeType
>;

// ============================================
// 실행 관련 타입
// ============================================

// 노드 실행 결과
