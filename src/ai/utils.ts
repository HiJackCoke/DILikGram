// ============================================================================
// SERVER ACTIONS
// ============================================================================

import {
  buildAnalysisContext,
  buildSinglePageContext,
} from "@/utils/ai/contextBuilder";

import { PRDAnalysisResult } from "@/types/ai/prdAnalysis";

// ============================================================================
// PRIVATE HELPERS (generateWorkflowAction — generation)
// ============================================================================

/**
 * Build the list of enriched PRD text strings to generate against.
 * - No analysisResult → [prdText] (single call, no context)
 * - Single page       → [prdText + full analysis context] (single call)
 * - Multiple pages    → one entry per page with per-page context (N calls)
 */
export function buildGenerationContexts(
  prdText: string | undefined,
  analysisResult: PRDAnalysisResult | undefined,
): Array<string | undefined> {
  if (!analysisResult) return [prdText];

  if (analysisResult.pages.length > 1) {
    return analysisResult.pages.map(
      (_, i) =>
        `${prdText ?? ""}\n\n${buildSinglePageContext(analysisResult, i)}`,
    );
  }

  return [`${prdText ?? ""}\n\n${buildAnalysisContext(analysisResult)}`];
}
