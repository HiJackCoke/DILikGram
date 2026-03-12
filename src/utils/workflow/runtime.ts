/**
 * Runtime executor - compiles and executes user-defined functions
 */
import type {
  ExecutionConfig,
  ExecutorFunction,
  ExecutionResult,
} from "@/types/workflow";
import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";

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
    /new\s+Promise\s*\(/, // Promise(
  ];

  return asyncPatterns.some((pattern) => pattern.test(trimmedCode));
}

/**
 * Compile string code into executable function with generic types
 * Uses Function constructor for sync, AsyncFunction for async
 * Automatically detects if code is async from patterns
 *
 * @template TInput - Type of inputData
 * @template TOutput - Type of output data
 * @param config - Executor configuration with code and optional type metadata
 * @param nodeType - Optional node type for validation (task must be sync)
 * @returns Compiled function that can be executed
 * @throws Error if compilation fails (syntax error or validation error)
 */
export function compileExecutor<TInput = unknown, TOutput = unknown>(
  config: ExecutionConfig<TInput, TOutput>,
  nodeType?: WorkflowNodeType,
  internalNodes?: WorkflowNode[],
): ExecutorFunction<TInput, TOutput> {
  // Group 노드 처리: internalNodes를 순차 실행
  if (nodeType === "group" && internalNodes?.length) {
    const { functionCode } = config;

    return (async (inputData: unknown, fetch: typeof globalThis.fetch) => {
      let currentData = inputData;

      // PRE-PROCESSOR: Transform incoming data to shape internal nodes expect
      if (config.initFunctionCode && config.initFunctionCode.trim()) {
        try {
          const isInitAsync = detectAsync(config.initFunctionCode);
          if (isInitAsync) {
            const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
            const initFn = new AsyncFn("inputData", "fetch", config.initFunctionCode);
            currentData = await initFn(inputData, fetch);
          } else {
            const initFn = new Function("inputData", "fetch", config.initFunctionCode);
            currentData = initFn(inputData, fetch);
          }
        } catch (error) {
          throw new Error(`GroupNode init failed: ${(error as Error).message}`);
        }
      }

      // Internal nodes 순차 실행
      for (const node of internalNodes) {
        const nodeConfig = node.data.execution?.config;
        if (nodeConfig) {
          try {
            // No functionCode: use simulated output or passthrough (never crash)
            if (!nodeConfig.functionCode) {
              if (nodeConfig.simulation?.enabled && nodeConfig.nodeData?.outputData !== undefined) {
                currentData = nodeConfig.nodeData.outputData;
              }
              // else: passthrough (currentData unchanged)
              continue;
            }
            const nodeFn = compileExecutor(nodeConfig, node.type);
            currentData = await Promise.resolve(nodeFn(currentData, fetch));
          } catch (error) {
            throw new Error(
              `Error executing internal node ${node.id} (${node.type}): ${(error as Error).message}`,
            );
          }
        }
      }

      // 커스텀 functionCode가 있으면 실행
      if (functionCode && functionCode.trim()) {
        const isAsync = detectAsync(functionCode);
        try {
          if (isAsync) {
            const AsyncFunction = Object.getPrototypeOf(
              async function () {},
            ).constructor;
            const customFn = new AsyncFunction(
              "inputData",
              "fetch",
              "outputData",
              functionCode,
            );
            return await customFn(currentData, fetch, currentData);
          } else {
            const customFn = new Function(
              "inputData",
              "fetch",
              "outputData",
              functionCode,
            );
            return customFn(currentData, fetch, currentData);
          }
        } catch (error) {
          throw new Error(
            `Error executing custom code: ${(error as Error).message}`,
          );
        }
      }

      return currentData;
    }) as ExecutorFunction<TInput, TOutput>;
  }

  // 일반 노드 처리
  const { functionCode } = config;

  // Ensure functionCode is always a string (runtime check)
  if (typeof functionCode !== "string") {
    throw new Error("functionCode must be a string");
  }

  const isAsync = detectAsync(functionCode);

  // TaskNode and DecisionNode must be sync-only
  if ((nodeType === "task" || nodeType === "decision") && isAsync) {
    const label = nodeType === "task" ? "TaskNode" : "DecisionNode";
    throw new Error(
      `${label} executors must be synchronous. ` +
        "Async code detected (await, .then, Promise, async). " +
        "Please use a ServiceNode for asynchronous operations instead.",
    );
  }

  // Store async flag in config
  config.isAsync = isAsync;

  try {
    if (isAsync) {
      // Create async function: async (inputData, fetch) => { ...code... }
      const AsyncFunction = Object.getPrototypeOf(
        async function () {},
      ).constructor;

      return new AsyncFunction(
        "inputData",
        "fetch",
        functionCode,
      ) as ExecutorFunction<TInput, TOutput>;
    } else {
      // Create sync function: (inputData, fetch) => { ...code... }
      return new Function(
        "inputData",
        "fetch",
        functionCode,
      ) as ExecutorFunction<TInput, TOutput>;
    }
  } catch (error) {
    // Compilation error (syntax error, etc.)
    throw new Error(`Failed to compile executor: ${(error as Error).message}`);
  }
}

/**
 * Create mock fetch implementation for simulation mode
 * Returns configured mock response without making real network calls
 */
function createMockFetch(mockResponse: unknown): typeof globalThis.fetch {
  return async (_url: string | URL | Request, _init?: RequestInit) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return mock Response object
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/json",
      },
    }) as Response;
  };
}

/**
 * Execute a compiled function with error handling and timeout protection
 *
 * @param executorFn - Compiled executor function
 * @param inputData - Input data from parent node
 * @param timeout - Maximum execution time in milliseconds (default 30s)
 * @param simulationMode - Enable simulation mode (uses mock fetch instead of real fetch)
 * @param mockData - Mock data to return in simulation mode (from nodeData.outputData)
 * @returns Execution result with success status, data, and timing
 */
export async function executeFunction(
  executorFn: ExecutorFunction,
  inputData: unknown,
  timeout: number = 30000,
  simulationMode: boolean = false,
  mockData?: unknown,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Use mock fetch in simulation mode, otherwise use real fetch
    const fetchImpl =
      simulationMode && mockData !== undefined
        ? createMockFetch(mockData)
        : globalThis.fetch;

    const resultPromise = Promise.resolve(executorFn(inputData, fetchImpl));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Execution timeout")), timeout),
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
