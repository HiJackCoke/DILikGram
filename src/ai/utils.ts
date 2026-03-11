// ============================================================================
// SERVER ACTIONS
// ============================================================================

import { GenerateWorkflowActionParams } from "@/types";
import {
  buildAnalysisContext,
  buildSinglePageContext,
} from "@/utils/ai/contextBuilder";

// ============================================================================
// PRIVATE HELPERS (generateWorkflowAction — generation)
// ============================================================================

/**
 * Build the list of enriched PRD text strings to generate against.
 * - No analysisResult → [prompt] (single call, no context)
 * - Single page       → [prompt + full analysis context] (single call)
 * - Multiple pages    → one entry per page with per-page context (N calls)
 */
export function buildGenerationContexts({
  prompt,
  analysisResult,
}: Pick<GenerateWorkflowActionParams, "prompt" | "analysisResult">): Array<
  string | undefined
> {
  if (!analysisResult) return [prompt];

  if (analysisResult.pages.length > 1) {
    return analysisResult.pages.map(
      (_, i) =>
        `${prompt ?? ""}\n\n${buildSinglePageContext(analysisResult, i)}`,
    );
  }

  return [`${prompt ?? ""}\n\n${buildAnalysisContext(analysisResult)}`];
}
