/**
 * UI Preview fixtures
 *
 * Pre-built React component code for each sample scenario.
 * Used by generateUIAction to bypass OpenAI during development.
 *
 * To regenerate: python3 scripts/build-ui-previews.py
 */

import type { GeneratedUIPage } from "@/types/ai/uiGeneration";

import fitnessJson from "./data/fitness.json";
import basketballJson from "./data/basketball.json";
import travelJson from "./data/travel.json";
import focusJson from "./data/focus.json";

interface UIPreviewData {
  capturedAt: string;
  pages: GeneratedUIPage[];
}

const UI_PREVIEW_MAP: Record<string, UIPreviewData> = {
  fitness: fitnessJson as UIPreviewData,
  basketball: basketballJson as UIPreviewData,
  travel: travelJson as UIPreviewData,
  focus: focusJson as UIPreviewData,
};

export function getUIPreviewBySampleId(
  sampleId: string,
): GeneratedUIPage[] | null {
  return UI_PREVIEW_MAP[sampleId]?.pages ?? null;
}
