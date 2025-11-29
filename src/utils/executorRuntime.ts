/**
 * Runtime executor - compiles and executes user-defined functions
 */
import type {
  ExecutorConfig,
  ExecutorFunction,
  ExecutorResult,
} from "@/types/executor";
import type { WorkflowNodeType } from "@/types/nodes";

/**
 * Detects if code contains async/await patterns
 */
export function detectAsync(code: string): boolean {
  const trimmedCode = code.trim();

  // Check for common async patterns
  const asyncPatterns = [
    /\bawait\s+/, // await keyword
    /\basync\s+function/, // async function
    /\basync\s*\(/, // async ()
    /\.then\s*\(/, // .then( promises
    /new\s+Promise\s*\(/, // new Promise(
  ];

  return asyncPatterns.some((pattern) => pattern.test(trimmedCode));
}

/**
 * Compile string code into executable function with generic types
 * Uses Function constructor for sync, AsyncFunction for async
 * Automatically detects if code is async from patterns
 *
 * @template TInput - Type of nodeInput
 * @template TOutput - Type of output data
 * @param config - Executor configuration with code and optional type metadata
 * @param nodeType - Optional node type for validation (task must be sync)
 * @returns Compiled function that can be executed
 * @throws Error if compilation fails (syntax error or validation error)
 */
export function compileExecutor<TInput = unknown, TOutput = unknown>(
  config: ExecutorConfig<TInput, TOutput>,
  nodeType?: WorkflowNodeType
): ExecutorFunction<TInput, TOutput> {
  const { functionCode } = config;

  // Ensure functionCode is always a string (runtime check)
  if (typeof functionCode !== "string") {
    throw new Error("functionCode must be a string");
  }

  const isAsync = detectAsync(functionCode);

  // TaskNode must be sync-only
  if (nodeType === "task" && isAsync) {
    throw new Error(
      "TaskNode executors must be synchronous. " +
        "Async code detected (await, .then, Promise, async). " +
        "Please use a ServiceNode for asynchronous operations instead."
    );
  }

  // Store async flag in config
  config.isAsync = isAsync;

  try {
    if (isAsync) {
      // Create async function: async (nodeInput, fetch) => { ...code... }
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;

      return new AsyncFunction(
        "nodeInput",
        "fetch",
        functionCode
      ) as ExecutorFunction<TInput, TOutput>;
    } else {
      // Create sync function: (nodeInput, fetch) => { ...code... }
      return new Function(
        "nodeInput",
        "fetch",
        functionCode
      ) as ExecutorFunction<TInput, TOutput>;
    }
  } catch (error) {
    // Compilation error (syntax error, etc.)
    throw new Error(`Failed to compile executor: ${(error as Error).message}`);
  }
}

/**
 * Execute a compiled function with error handling and timeout protection
 *
 * @param executorFn - Compiled executor function
 * @param nodeInput - Input data from parent node
 * @param timeout - Maximum execution time in milliseconds (default 30s)
 * @returns Execution result with success status, data, and timing
 */
export async function executeFunction(
  executorFn: ExecutorFunction,
  nodeInput: unknown,
  timeout: number = 30000
): Promise<ExecutorResult> {
  const startTime = Date.now();

  try {
    const resultPromise = Promise.resolve(executorFn(nodeInput, fetch));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Execution timeout")), timeout)
    );

    const data = await Promise.race([resultPromise, timeoutPromise]);

    return {
      success: true,
      data,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack,
        timestamp: Date.now(),
      },
      executionTime: Date.now() - startTime,
    };
  }
}
