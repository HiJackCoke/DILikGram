/**
 * PRD Context Builder
 *
 * Builds context string from PRD text for OpenAI prompt
 */

import type { PRDAnalysisResult } from "@/types/ai/prdAnalysis";

/**
 * Build structured context from PRD analysis result for workflow generation.
 * Injected alongside the raw PRD to give AI a pre-structured reference,
 * reducing hallucination and improving coverage.
 *
 * @param analysis - Structured analysis result from analyzePRDAction
 * @returns Formatted context string to append to the generation prompt
 */
export function buildAnalysisContext(analysis: PRDAnalysisResult): string {
  const pageLines = analysis.pages
    .map((page) => {
      const featureLines = page.features
        .map(
          (f) =>
            `    - [${f.priority.toUpperCase()}] ${f.name}: ${f.description}`,
        )
        .join("\n");
      return `  • ${page.name}${page.path ? ` (${page.path})` : ""}\n${featureLines}`;
    })
    .join("\n\n");

  return `
═══════════════════════════════════════════════════════════════
PRD ANALYSIS SUMMARY (Pre-extracted Structure)
═══════════════════════════════════════════════════════════════

Product Goal: ${analysis.goal}

Pages & Features to cover:
${pageLines}

═══════════════════════════════════════════════════════════════
IMPORTANT: You MUST create nodes for every page and feature listed above.
Use GroupNodes for pages and child nodes for each feature within them.
═══════════════════════════════════════════════════════════════
`;
}

/**
 * Build PRD context for AI workflow generation
 *
 * @param prdText - Raw PRD text input from user
 * @returns Formatted context string for OpenAI prompt
 */
export function buildPRDContext(prdText: string): string {
  return `
═══════════════════════════════════════════════════════════════
PRD REQUIREMENTS
═══════════════════════════════════════════════════════════════

${prdText.trim()}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS — MANDATORY FULL COVERAGE
═══════════════════════════════════════════════════════════════

⚠️ You MUST generate nodes for EVERY feature, page, and API endpoint in this PRD.
   Partial implementation is unacceptable. Treat this as building a real MVP.

Coverage requirements (ALL are mandatory):
1. PAGES/SCREENS: Create a GroupNode for each user-facing page or screen
2. FEATURES: Create nodes for every feature listed (CRUD, auth, search, notifications, etc.)
3. API INTEGRATIONS: Create a ServiceNode for every API endpoint, database call, or third-party service mentioned
4. BUSINESS LOGIC: Create a DecisionNode for every conditional rule, validation, or branching logic
5. ERROR HANDLING: Every "no" branch from a DecisionNode must lead to an error handling flow

Scale expectation based on PRD complexity:
- Simple app (2-3 features): 15~25 nodes
- Medium app (4-6 features): 25~40 nodes
- Complex app (7+ features): 40~60+ nodes

For every node, include prdReference:
- section: the PRD section this node implements
- requirement: exact requirement text from PRD
- rationale: why this node is needed
`;
}
