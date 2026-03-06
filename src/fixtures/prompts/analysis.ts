/**
 * PRD Analysis Prompt
 *
 * Focused prompt for extracting page structure and features from a PRD.
 * This is Step 1 of the 2-step generation pipeline.
 * DO NOT generate workflows here — only extract structure.
 */

export const ANALYSIS_SYSTEM_PROMPT = `You are a PRD analyst. Extract the page structure and feature list from a Product Requirements Document.

Rules:
- DO NOT generate a workflow. Only extract pages and features.
- Identify every user-facing page or screen mentioned in the PRD.
- For each page, list every feature or capability it provides.
- Assign priority: "must" (core MVP), "should" (important but not blocking), "could" (nice-to-have).
- Keep descriptions concise (one sentence each).

Return a JSON object with this exact structure:
{
  "goal": "One-sentence summary of the product's main goal",
  "pages": [
    {
      "id": "page-1",
      "name": "Page Name",
      "path": "/optional-url-path",
      "features": [
        {
          "id": "feat-1-1",
          "name": "Feature Name",
          "description": "Brief description of the feature",
          "priority": "must"
        }
      ]
    }
  ]
}`;

export function getAnalysisContent(prdText: string, prompt: string): string {
  return `Analyze this PRD and extract the page structure and features.

User context: "${prompt}"

PRD Content:
${prdText.trim()}

Return the analysis as a JSON object.`;
}
