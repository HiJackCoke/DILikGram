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

  // 실행 관련
  inputData?: unknown;
  outputData?: unknown;
  error?: ExecutionError;
  executionTime?: number;
};

export type TaskNodeProps = NodeProps<TaskNodeData>;

// ============================================
// DecisionNode
// ============================================
export type DecisionNodeData = WorkflowNodeState & {
  title: string;
  condition?: string;
  ports?: NodePort[];

  // 실행 관련
  inputData?: unknown;
  evaluationResult?: boolean;  // true면 yes, false면 no
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

  // 실행 관련
  inputData?: unknown;
  outputData?: unknown;
  error?: ExecutionError;
  executionTime?: number;
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

// ============================================
// 실행 관련 타입
// ============================================

// 노드 실행 결과
export type ExecutionOutput = {
  data: unknown;          // 출력 데이터
  timestamp: number;      // 실행 완료 시간
  executionTime: number;  // 실행 시간(ms)
};

// 노드 실행 에러
export type ExecutionError = {
  message: string;
  stack?: string;
  timestamp: number;
};

// 전체 워크플로우 실행 컨텍스트
export type ExecutionContext = {
  outputs: Map<string, ExecutionOutput>;  // nodeId -> output
  errors: Map<string, ExecutionError>;    // nodeId -> error
  startTime: number;
  endTime?: number;
};
