/**
 * Helper functions for creating typed executor configurations
 *
 * These helpers provide TypeScript type inference for executor functions
 * while maintaining string-based storage for serialization.
 */
import type { ExecutorConfig } from "@/types/executor";

/**
 * Create a typed executor with full type inference
 *
 * Provides compile-time type checking and IDE autocomplete for nodeInput/nodeOutput
 * while storing the function as a serializable string.
 *
 * @template TInput - Type of nodeInput received from parent node
 * @template TOutput - Type of output data returned by executor
 * @param functionCode - JavaScript code as string (will be compiled at runtime)
 * @param meta - Optional metadata for displaying types in editor UI
 * @returns Typed executor configuration
 *
 * @example
 * ```typescript
 * // Simple transform
 * createTypedExecutor<
 *   { text: string },
 *   { result: string }
 * >('return { result: nodeInput.text.toUpperCase() };')
 *
 * // Async API call
 * createTypedExecutor<
 *   { userId: string },
 *   { user: User }
 * >(
 *   'const res = await fetch(`/api/users/${nodeInput.userId}`); return { user: await res.json() };',
 *   {
 *     inputType: '{ userId: string }',
 *     outputType: '{ user: User }'
 *   }
 * )
 * ```
 */
export function createTypedExecutor<TInput, TOutput>(
  functionCode: string,
  meta?: {
    inputType?: string;
    outputType?: string;
  }
): ExecutorConfig<TInput, TOutput> {
  return {
    functionCode,
    lastModified: Date.now(),
    __meta: meta,
  };
}
