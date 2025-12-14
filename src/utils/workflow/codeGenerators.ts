/**
 * Panel Code Generators Registry
 *
 * This module provides a unified registry-based system for generating
 * functionCode from panel mode inputs across different node types.
 *
 * To add a new node type with panel code generation:
 * 1. Add a generator function to PANEL_CODE_GENERATORS
 * 2. No other changes needed - handleSave logic automatically adapts
 */

import type { WorkflowNodeType, ConditionOperator } from "@/types/nodes";

/**
 * Generator function type - takes form data and returns generated code
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PanelCodeGenerator<T = any> = (data: T) => string;

/**
 * Registry mapping node types to their panel code generators
 *
 * Each generator receives the entire formData object and extracts
 * the fields it needs to generate the appropriate functionCode.
 */
const PANEL_CODE_GENERATORS: Partial<
  Record<WorkflowNodeType, PanelCodeGenerator>
> = {
  /**
   * Service Node Generator
   * Generates HTTP fetch code from http configuration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: (data: any) => {
    const { http = {} } = data;
    const { headers = {}, body = {}, endpoint = "", method = "GET" } = http;

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
  },

  /**
   * Decision Node Generator
   * Generates condition evaluation code from condition configuration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decision: (data: any) => {
    const { condition = {} } = data;

    const entries = Object.entries(condition) as [ConditionOperator, string][];

    if (entries.length === 0) {
      return `// No conditions specified\nreturn {\n  ...inputData,\n  success: false\n};`;
    }

    const conditionExpressions: string[] = [];

    entries.forEach(([operator, key]) => {
      if (!key) return;

      let expression: string;
      switch (operator) {
        case "has":
          expression = `"${key}" in inputData`;
          break;
        case "hasNot":
          expression = `!("${key}" in inputData)`;
          break;
        case "truthy":
          expression = `Boolean(inputData["${key}"])`;
          break;
        case "falsy":
          expression = `!Boolean(inputData["${key}"])`;
          break;
        default:
          return;
      }
      conditionExpressions.push(expression);
    });

    if (conditionExpressions.length === 0) {
      return `// No valid conditions\nreturn {\n  ...inputData,\n  success: false\n};`;
    }

    const combinedExpression =
      conditionExpressions.length === 1
        ? conditionExpressions[0]
        : conditionExpressions.join(" && ");

    const conditionSummary = entries
      .map(([op, key]) => `${op} ${key}`)
      .join(", ");

    return `// Auto-generated conditions: ${conditionSummary}
const success = ${combinedExpression};

return {
  ...inputData,
  success
};`;
  },

  // Future node types can be added here
  // Example:
  // task: (data: any) => {
  //   // Generate task execution code
  //   return generatedCode;
  // },
};

/**
 * Generate panel code for a given node type
 *
 * @param nodeType - The type of workflow node
 * @param formData - The form data from the properties panel
 * @returns Generated function code or null if no generator exists
 *
 * @example
 * ```typescript
 * const code = generatePanelCode("service", {
 *   http: { method: "GET", endpoint: "/api/users" }
 * });
 * ```
 */
export function generatePanelCode(
  nodeType: WorkflowNodeType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
): string | null {
  const generator = PANEL_CODE_GENERATORS[nodeType];

  if (!generator) {
    return null; // No generator for this node type
  }

  return generator(formData);
}

/**
 * Check if a node type supports panel code generation
 *
 * @param nodeType - The type of workflow node to check
 * @returns True if the node type has a panel code generator
 *
 * @example
 * ```typescript
 * if (supportsPanelCodeGeneration("service")) {
 *   // Generate code for service node
 * }
 * ```
 */
export function supportsPanelCodeGeneration(
  nodeType: WorkflowNodeType
): boolean {
  return nodeType in PANEL_CODE_GENERATORS;
}
