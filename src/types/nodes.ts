import type { ReactNode } from "react";
import type { NodeProps, Position, Node } from "react-cosmos-diagram";
import type { ExecutionData } from "./workflow";
import type { PRDReference, TestCase } from "./prd";

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
  | "service"
  | "group";

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
  branchLabel?: "yes" | "no";
  /** PRD reference linking node to requirements */
  prdReference?: PRDReference;
  /** Test cases for node validation (minimum 3 recommended) */
  testCases?: TestCase[];
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

export type EndNodeData = {
  title?: string;
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
  condition?: ConditionConfig;
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

export type ConditionOperator = "has" | "hasNot" | "truthy" | "falsy";

export type ConditionConfig = Partial<Record<ConditionOperator, string>>;

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

// ============================================
// GroupNode
// ============================================

/**
 * Group Node Data Structure
 * 순차 실행되는 feature 단위를 나타내는 노드
 */
export type GroupNodeData = {
  icon?: ReactNode;
  title: string;
  description?: string;

  /**
   * 순차 실행될 내부 노드 배열
   * 실행 순서: groups[0] → groups[1] → ... → groups[n-1]
   * 데이터 플로우: 각 노드는 이전 노드의 output을 input으로 받음
   */
  groups: WorkflowNode[];

  /**
   * 메타데이터
   */
  metadata?: Record<string, string>;

  /**
   * UI 상태 (확장/축소)
   */
  collapsed?: boolean;
};

export type GroupNodeProps = WorkflowNodeProps<GroupNodeData>;

export type WorkflowNodeMap = {
  start: StartNodeData;
  end: EndNodeData;
  task: TaskNodeData;
  decision: DecisionNodeData;
  service: ServiceNodeData;
  group: GroupNodeData;
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
    | GroupNodeData
  >,
  WorkflowNodeType //react-cosmos-diagram 에서 type 엄격화가 안되어서 우선 string 추가
>;

// ============================================
// 실행 관련 타입
// ============================================

// 노드 실행 결과
