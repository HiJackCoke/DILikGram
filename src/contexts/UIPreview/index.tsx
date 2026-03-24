"use client";

import { createContext, useState, useCallback, use } from "react";
import type { ReactNode } from "react";
import type { WorkflowNode } from "@/types/nodes";
import type { AnalyzePRDResult } from "@/types/ai/prdAnalysis";
import type { GeneratedUIPage } from "@/types/ai/uiGeneration";
import { generateUIAction } from "@/app/_actions/ai";
import UIPreviewModal from "./Modal";

export interface OpenUIPreviewParams {
  nodes: WorkflowNode[];
  analysisResult: AnalyzePRDResult;
  sampleId: string | null;
}

interface UIPreviewContextValue {
  open: (params: OpenUIPreviewParams) => void;
  close: () => void;
}

const UIPreviewContext = createContext<UIPreviewContextValue | null>(null);

export function UIPreviewProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  const [pages, setPages] = useState<GeneratedUIPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (params: OpenUIPreviewParams) => {
    setShow(true);
    setPages([]);
    setError(null);
    setIsLoading(true);

    try {
      const result = await generateUIAction({
        analysisResult: params.analysisResult,
        nodes: params.nodes,
        sampleId: params.sampleId ?? undefined,
      });
      setPages(result.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UI 생성에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setShow(false);
  }, []);

  return (
    <UIPreviewContext value={{ open, close }}>
      {children}

      <UIPreviewModal
        show={show}
        pages={pages}
        isLoading={isLoading}
        error={error}
        onClose={close}
      />
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
