/**
 * Executor function type definitions
 */

import type { WorkflowNode, WorkflowNodeType } from "./nodes";
import type { WorkflowEdge } from "./edges";

/**
 * Workflow execution mode
 * Decision nodes branch based on function result (outputData.success)
 */
// export type WorkflowMode = "auto";

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
  executorData: ExecutionData,
) => void;

/**
 * Callback invoked when an edge's data is updated
 */
export type OnEdgeUpdateCallback = (
  edgeId: string,
  data: Partial<WorkflowEdge["data"]>,
) => void;

/**
 * Callback invoked when all workflow execution is complete with final node states
 */
export type OnNodeUpdateEndCallback = (nodes: WorkflowNode[]) => void;

/**
 * Configuration object for WorkflowExecutor
 */
export type WorkflowExecutorConfig = {
  /** Workflow nodes to execute */
  nodes: WorkflowNode[];
  /** Edges connecting the workflow nodes */
  edges: WorkflowEdge[];
  /** Execution mode: success or failure path simulation */
  // mode: WorkflowMode;
  /** Optional specific Start node ID to execute from */
  startNodeId?: string;
  /** Enable global simulation mode (use mock responses instead of real execution) */
  simulationMode?: boolean;
  /** Callback invoked when execution state changes */
  onStateChange: OnStateChangeCallback;
  /** Optional callback invoked when node executor data updates */
  onNodeUpdate?: OnNodeUpdateCallback;
  /** Optional callback invoked when edge data updates */
  onEdgeUpdate?: OnEdgeUpdateCallback;
  /** Optional callback invoked when all execution is complete with final nodes */
  onNodeUpdateEnd?: OnNodeUpdateEndCallback;
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
  fetch: typeof globalThis.fetch,
) => Promise<TOutput> | TOutput;

/**
 * Serializable configuration stored in node data with type inference support
 *
 * @template TInput - Type of inputData received from parent node
 * @template TOutput - Type of output data returned by executor
 */
export type ExecutionConfig<TInput = unknown, TOutput = unknown> = {
  functionCode: string;
  initFunctionCode?: string; // GroupNode PRE-processor: runs before internal nodes, transforms parent output → internal nodes' expected input
  lastModified?: number;
  isAsync?: boolean; // Set during compilation
  nodeData?: {
    inputData?: TInput;
    outputData?: TOutput;
  };
  simulation?: {
    enabled: boolean; // Enable simulation mode for this node
    mockResponse?: TOutput; // User-defined mock response (optional)
  };
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

/**
 * Node execution log entry for END node summary
 */
export type ExecutionLogEntry = {
  nodeId: string;
  nodeType: WorkflowNodeType;
  timestamp: number;
  executionTime: number;
  outputData?: unknown;
  success: boolean;
};

/**
 * Aggregated execution summary for END nodes
 * Contains complete workflow execution history and metrics
 */
export type ExecutionSummary = {
  /** Execution path: ordered array of executed node IDs */
  executedPath: string[];
  /** Detailed execution logs for each node */
  logs: ExecutionLogEntry[];
  /** Total execution time from start to END node (ms) */
  totalExecutionTime: number;
  /** Count of successfully executed nodes */
  successCount: number;
  /** Map of all node outputs (nodeId -> ExecutionResult) */
  outputs: Map<string, ExecutionResult>;
  /** Workflow start timestamp */
  startTime: number;
  /** Workflow end timestamp (when END node is reached) */
  endTime: number;
};

export type ExecutionState = "idle" | "executing" | "executed";

export type ExecutionData = {
  // result?: NodeResult;
  state?: ExecutionState;
  config?: ExecutionConfig; // Executor function configuration
  error?: ExecutionError; // Store execution errors for UI display
  summary?: ExecutionSummary; // END node execution summary
};
