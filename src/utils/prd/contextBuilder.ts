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
IMPORTANT: Implement every page and feature above with the following MANDATORY structure:

Per page:
  1. Create ONE root Task node (no parentNode, inputData: null)
  2. For EACH feature of that page, create ONE GroupNode chained sequentially
     (feature count = GroupNode count — mandatory 1:1 mapping)
  3. Every GroupNode MUST contain at least 2 internal child nodes (Task/Service/Decision)

Do NOT replace GroupNodes with bare TaskNodes or ServiceNodes.
Feature count per page = GroupNode count per page. This is not optional.
═══════════════════════════════════════════════════════════════
`;
}

/**
 * Build context for a single page in a multi-page PRD.
 * Used for per-page generation — each API call sees only one page's features.
 *
 * @param analysis - Full PRD analysis result
 * @param pageIndex - Zero-based index of the page to build context for
 * @returns Formatted context string for a single page
 */
export function buildSinglePageContext(
  analysis: PRDAnalysisResult,
  pageIndex: number,
): string {
  const page = analysis.pages[pageIndex];
  const featureLines = page.features
    .map((f) => `    - [${f.priority.toUpperCase()}] ${f.name}: ${f.description}`)
    .join("\n");

  const groupNodeChain = page.features
    .map((f, i) => {
      if (i === 0) return `    GroupNode 1 (${f.name}): parentNode = root Task id`;
      return `    GroupNode ${i + 1} (${f.name}): parentNode = GroupNode ${i} id`;
    })
    .join("\n");

  return `
═══════════════════════════════════════════════════════════════
PRD ANALYSIS SUMMARY (Page ${pageIndex + 1} of ${analysis.pages.length})
═══════════════════════════════════════════════════════════════

Product Goal: ${analysis.goal}

Page to implement: ${page.name}${page.path ? ` (${page.path})` : ""}

Features to cover:
${featureLines}

═══════════════════════════════════════════════════════════════
IMPORTANT: Implement every feature above with the following MANDATORY structure:

Step 1 — Root node:
  Create ONE root Task node for "${page.name}" (no parentNode, inputData: null)

Step 2 — Feature GroupNodes (${page.features.length} features → EXACTLY ${page.features.length} GroupNodes):
  Chain GroupNodes sequentially from the root:
${groupNodeChain}

Step 3 — Internal nodes per GroupNode (mandatory):
  Every GroupNode MUST have at least 2 child nodes (Task/Service/Decision).
  Internal node parentNode = their parent GroupNode id.

${page.features.length} features listed = ${page.features.length} GroupNodes required. Do NOT skip any.
This is a single independent workflow tree. Do NOT reference other pages.
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
