/**
 * Build a complete AI prompt by combining operation-specific rules
 *
 * Refactored for Simplified Workflow:
 * - Removes injection of complex legacy rules (Edge counts, Start/End checks).
 * - Focuses on assembling the 'promptContent' provided by the specific operation modules.
 * - Enforces JSON-only output.
 */
export function buildPrompt(config: {
  operation: "generation" | "modification";
  promptContent: string;
}): string {
  const { operation, promptContent } = config;

  const intro =
    operation === "generation"
      ? "You are a workflow design assistant. Generate structured workflow nodes based on user descriptions."
      : "You are a workflow editor AI. Your task is to modify existing workflow nodes based on user requests.";

  const jsonEnforcement = `
IMPORTANT OUTPUT RULES:
1. Return ONLY valid JSON.
2. Do NOT include markdown code blocks (e.g., \`\`\`json).
3. Do NOT include explanations or text outside the JSON object.
  `;

  return `
${intro}

${promptContent}

${jsonEnforcement}
  `.trim();
}
