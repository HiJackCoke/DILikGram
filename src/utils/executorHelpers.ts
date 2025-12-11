/**
 * Helper functions for creating typed executor configurations
 *
 * These helpers provide TypeScript type inference for executor functions
 * while maintaining string-based storage for serialization.
 */
import type { ExecutorConfig } from "@/types/executor";
import type { ServiceNodeData } from "@/types/nodes";

/**
 * Create a typed executor with full type inference
 *
 * Provides compile-time type checking and IDE autocomplete for inputData/outputData
 * while storing the function as a serializable string.
 *
 * @template TInput - Type of inputData received from parent node
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
 * >('return { result: inputData.text.toUpperCase() };')
 *
 * // Async API call
 * createTypedExecutor<
 *   { userId: string },
 *   { user: User }
 * >(
 *   'const res = await fetch(`/api/users/${inputData.userId}`); return { user: await res.json() };',
 *   {
 *     inputData: '{ userId: string }',
 *     outputData: '{ user: User }'
 *   }
 * )
 * ```
 */
export function createTypedExecutor<TInput, TOutput>(
  functionCode: string,
  meta?: {
    inputData?: unknown;
    outputData?: unknown;
  }
): ExecutorConfig<TInput, TOutput> {
  return {
    functionCode,
    lastModified: Date.now(),
    nodeData: meta,
  };
}

/**
 * Infer detailed type representation from value with multiline formatting
 * @param value - Value to infer type from
 * @param indent - Current indentation level (for nested structures)
 * @returns Type representation string with proper formatting
 */
function inferDetailed(value: unknown, indent: number = 0): string {
  const indentStr = "  ".repeat(indent);
  const nextIndentStr = "  ".repeat(indent + 1);

  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";

    const elementTypes = new Set(
      value.map((v) => inferDetailed(v, indent + 1))
    );

    if (elementTypes.size === 1) {
      const elementType = Array.from(elementTypes)[0];
      return `${elementType}[]`;
    }

    return `(${Array.from(elementTypes).join(" | ")})[]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    const props = entries.map(
      ([key, val]) =>
        `${nextIndentStr}${key}: ${inferDetailed(val, indent + 1)}`
    );

    return `{\n${props.join(",\n")}\n${indentStr}}`;
  }

  return typeof value;
}

export function inferType(value: unknown): string {
  let target: unknown = value;

  // 문자열이면 JSON parse 시도
  if (typeof value === "string") {
    try {
      target = JSON.parse(value);
    } catch {
      const cleaned = value.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');

      try {
        target = JSON.parse(cleaned);
      } catch {
        return "string";
      }
    }
  }

  return inferDetailed(target);
}

export function stringifyForDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function generateFunctionCodeFromPanel(
  input: Pick<ServiceNodeData, "headers" | "body" | "endpoint" | "method">
): string {
  const { headers = {}, body = {}, endpoint = "", method = "GET" } = input;

  const headersStr = JSON.stringify(headers, null, 2);
  const isGetMethod = method === "GET";

  // Build variable declarations
  let code = `const headers = ${headersStr}\n`;

  // Only declare body for non-GET methods
  if (!isGetMethod) {
    const bodyStr = JSON.stringify(body, null, 2);
    code += `const body = ${bodyStr}\n`;
  }

  code += `const endpoint = ${JSON.stringify(endpoint)}\n`;
  code += `const method = ${JSON.stringify(method)}\n\n`;

  // Build fetch options
  code += `const response = await fetch(endpoint, {\n`;
  code += `  method,\n`;
  code += `  headers,\n`;

  // Only include body in fetch options for non-GET methods
  if (!isGetMethod) {
    code += `  body: JSON.stringify(body),\n`;
  }

  code += `})\n\n`;
  code += `return response.json()`;

  return code;
}
