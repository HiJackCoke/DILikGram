/**
 * Executor function type definitions
 */

import type { WorkflowNode } from "./nodes";
import type { WorkflowEdge } from "./edges";

/**
 * Workflow execution mode for simulation
 */
export type WorkflowMode = "success" | "failure";

/**
 * Workflow runtime state
 */
export type WorkflowRuntimeState = {
  isRunning: boolean;
  context: WorkflowContext;
};

/**
 * Workflow context tracking outputs and errors
 */
export type WorkflowContext = {
  outputs: Map<string, ExecutionResult>;
  errors: Map<string, ExecutionError>;
  startTime: number;
  endTime?: number;
};

/**
 * Callback invoked when workflow execution state changes
 */
export type OnStateChangeCallback = (state: WorkflowRuntimeState) => void;

/**
 * Callback invoked when a node's executor data is updated
 */
export type OnNodeUpdateCallback = (
  nodeId: string,
  executorData: ExecutionData
) => void;

/**
 * Callback invoked when an edge's data is updated
 */
export type OnEdgeUpdateCallback = (
  edgeId: string,
  data: Partial<WorkflowEdge["data"]>
) => void;

/**
 * Configuration object for WorkflowExecutor
 */
export type WorkflowExecutorConfig = {
  /** Workflow nodes to execute */
  nodes: WorkflowNode[];
  /** Edges connecting the workflow nodes */
  edges: WorkflowEdge[];
  /** Execution mode: success or failure path simulation */
  mode: WorkflowMode;
  /** Callback invoked when execution state changes */
  onStateChange: OnStateChangeCallback;
  /** Optional callback invoked when node executor data updates */
  onNodeUpdate?: OnNodeUpdateCallback;
  /** Optional callback invoked when edge data updates */
  onEdgeUpdate?: OnEdgeUpdateCallback;
};

export type ExecutionError = {
  message: string;
  stack?: string;
  timestamp: number;
};

/**
 * Node function signature with generic input/output types
 * - Receives inputData from parent node
 * - Returns output data (can be async)
 * - Has access to fetch API for external calls
 */
export type ExecutorFunction<TInput = unknown, TOutput = unknown> = (
  inputData: TInput,
  fetch: typeof globalThis.fetch
) => Promise<TOutput> | TOutput;

/**
 * Serializable configuration stored in node data with type inference support
 *
 * @template TInput - Type of inputData received from parent node
 * @template TOutput - Type of output data returned by executor
 */
export type ExecutionConfig<TInput = unknown, TOutput = unknown> = {
  functionCode: string;
  lastModified: number;
  isAsync?: boolean; // NEW: Set during compilation
  nodeData?: { inputData?: TInput; outputData?: TOutput };
};

/**
 * Node execution result with success/failure information (discriminated union)
 */

export type ExecutionResult<T = unknown> = {
  data?: T;
  error?: ExecutionError;
  success: boolean;
  timestamp?: number;
  executionTime?: number;
};

export type ExecutionState = "idle" | "executing" | "executed";

export type ExecutionData = {
  // result?: NodeResult;
  state?: ExecutionState;
  config?: ExecutionConfig; // Executor function configuration
  error?: ExecutionError; // NEW: Store execution errors for UI display
};
