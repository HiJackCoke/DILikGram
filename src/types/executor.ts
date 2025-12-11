/**
 * Executor function type definitions
 */

export type ExecutionError = {
  message: string;
  stack?: string;
  timestamp: number;
};

// Re-export ExecutionError from nodes.ts

/**
 * Executor function signature with generic input/output types
 * - Receives nodeInput from parent node
 * - Returns output data (can be async)
 * - Has access to fetch API for external calls
 */
export type ExecutorFunction<TInput = unknown, TOutput = unknown> = (
  nodeInput: TInput,
  fetch: typeof globalThis.fetch
) => Promise<TOutput> | TOutput;

/**
 * Serializable configuration stored in node data with type inference support
 *
 * @template TInput - Type of nodeInput received from parent node
 * @template TOutput - Type of output data returned by executor
 */
export type ExecutorConfig<TInput = unknown, TOutput = unknown> = {
  functionCode: string;
  lastModified: number;
  isAsync?: boolean; // NEW: Set during compilation
  nodeData?: { inputType?: unknown; outputType?: unknown };
  __phantomInput?: TInput;
  __phantomOutput?: TOutput;
};

/**
 * Execution result with success/failure information (discriminated union)
 */
export type ExecutorResult =
  | {
      success: true;
      data: unknown;
      executionTime: number;
    }
  | {
      success: false;
      error: ExecutionError;
      executionTime: number;
    };

export type ExecutorState = "idle" | "executing" | "executed";

export type ExecutorData = {
  result?: ExecutorResult;
  state?: ExecutorState;
  config?: ExecutorConfig; // Executor function configuration
};
