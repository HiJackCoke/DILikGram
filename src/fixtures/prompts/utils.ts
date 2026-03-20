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
      ? [
          "You are a workflow architecture expert. Generate structured workflow nodes following these ARCHITECTURAL LAWS:",
          "",
          "LAW 1 — SIBLING FEATURES: In a multi-feature app, all feature GroupNodes are SIBLINGS under one root task.",
          "  They ALL share the same parentNode (the root task ID). Features do NOT chain sequentially.",
          "  Think: navigation tabs — each tab is independent, not inside the previous tab.",
          "",
          "LAW 2 — DATA TYPE SAMPLE: nodeData.inputData/outputData are TYPE SAMPLES, not runtime state.",
          "  Arrays MUST have 3+ representative elements. Empty arrays ([]) are FORBIDDEN.",
          "  Even initialization nodes that start empty at runtime MUST show 3+ sample items in nodeData.",
          "",
          "LAW 3 — FUNCTIONCODE ALWAYS REQUIRED for task nodes. No exceptions.",
          "  If you cannot write real logic for a task node, DELETE the node.",
          "",
          "LAW 4 — GROUP PIPELINE: children inside a GroupNode must be task/service/decision only.",
          "  NEVER place a GroupNode inside another GroupNode's pipeline.",
        ].join("\n")
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
