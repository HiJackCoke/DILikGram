/**
 * Executor function type definitions
 */

export type ExecutorError = {
  message: string;
  stack?: string;
  timestamp: number;
};

// Re-export ExecutorError from nodes.ts

/**
 * Executor function signature with generic input/output types
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
export type ExecutorConfig<TInput = unknown, TOutput = unknown> = {
  functionCode: string;
  lastModified: number;
  isAsync?: boolean; // NEW: Set during compilation
  nodeData?: { inputData?: TInput; outputData?: TOutput };
};

/**
 * Execution result with success/failure information (discriminated union)
 */

export type ExecutorResult<T = unknown> = {
  data?: T;
  error?: ExecutorError;
  success: boolean;
  timestamp?: number;
  executionTime?: number;
};

export type ExecutorState = "idle" | "executing" | "executed";

export type ExecutorData = {
  // result?: ExecutorResult;
  state?: ExecutorState;
  config?: ExecutorConfig; // Executor function configuration
};
