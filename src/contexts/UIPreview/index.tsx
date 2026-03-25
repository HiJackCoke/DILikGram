"use client";

import { createContext, useState, useCallback, use } from "react";
import type { ReactNode } from "react";
import type { WorkflowNode } from "@/types/nodes";
import type { AnalyzePRDResult } from "@/types/ai/prdAnalysis";
import { generateUIAction } from "@/app/_actions/ai";
import { uiPreviewCache } from "@/utils/workflow/uiPreviewCache";

/** sessionStorage key used to persist generated pages across navigation */
export const UI_PREVIEW_SESSION_KEY = "dg:ui-preview-pages";
/** sessionStorage key for the workflow versionId that produced the current pages */
export const UI_PREVIEW_VERSION_KEY = "dg:ui-preview-version";

export interface OpenUIPreviewParams {
  nodes: WorkflowNode[];
  analysisResult: AnalyzePRDResult;
  sampleId: string | null;
  /**
   * Current workflow version ID.
   * When provided, a localStorage cache is checked before calling the API.
   * Same versionId → instant load. New versionId → regenerate and cache.
   */
  versionId?: string;
}

interface UIPreviewContextValue {
  /** Load or generate pages, store in sessionStorage, then caller can navigate */
  open: (params: OpenUIPreviewParams) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const UIPreviewContext = createContext<UIPreviewContextValue | null>(null);

export function UIPreviewProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (params: OpenUIPreviewParams) => {
    setError(null);

    if (params.versionId) {
      // sessionStorage is always the most up-to-date source (refinements update it
      // in real-time). If it already holds pages for this exact version, reuse them
      // directly — this preserves any AI-refined code the user made previously.
      const storedVersionId = sessionStorage.getItem(UI_PREVIEW_VERSION_KEY);
      const storedPages = sessionStorage.getItem(UI_PREVIEW_SESSION_KEY);
      if (storedVersionId === params.versionId && storedPages) {
        return;
      }

      // sessionStorage has pages for a different version (or is empty) →
      // restore from localStorage cache if available.
      const cached = uiPreviewCache.get(params.versionId);
      if (cached) {
        sessionStorage.setItem(UI_PREVIEW_SESSION_KEY, JSON.stringify(cached));
        sessionStorage.setItem(UI_PREVIEW_VERSION_KEY, params.versionId);
        return;
      }
    }

    setIsLoading(true);

    try {
      const result = await generateUIAction({
        analysisResult: params.analysisResult,
        nodes: params.nodes,
        sampleId: params.sampleId ?? undefined,
      });

      sessionStorage.setItem(
        UI_PREVIEW_SESSION_KEY,
        JSON.stringify(result.pages),
      );

      // Persist versionId and cache for future visits
      if (params.versionId) {
        sessionStorage.setItem(UI_PREVIEW_VERSION_KEY, params.versionId);
        uiPreviewCache.set(params.versionId, result.pages);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UI 생성에 실패했습니다";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <UIPreviewContext value={{ open, isLoading, error }}>
      {children}
    </UIPreviewContext>
  );
}

export function useUIPreview() {
  const context = use(UIPreviewContext);
  if (!context) {
    throw new Error("useUIPreview must be used within UIPreviewProvider");
  }
  return context;
}
