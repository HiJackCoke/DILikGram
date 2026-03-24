"use client";

import { useState } from "react";
import ReactDOM from "react-dom";
import { X, Monitor, Tablet, Smartphone, Loader2 } from "lucide-react";
import UIPreviewFrame, {
  VIEWPORT,
} from "@/components/ui/UIPreviewFrame";
import type { ViewportSize } from "@/components/ui/UIPreviewFrame";
import type { GeneratedUIPage } from "@/types/ai/uiGeneration";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";

interface UIPreviewModalProps {
  show: boolean;
  pages: GeneratedUIPage[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

const VIEWPORT_ICONS: Record<ViewportSize, React.ReactNode> = {
  mobile: <Smartphone className="w-3.5 h-3.5" />,
  tablet: <Tablet className="w-3.5 h-3.5" />,
  desktop: <Monitor className="w-3.5 h-3.5" />,
};

export default function UIPreviewModal({
  show,
  pages,
  isLoading,
  error,
  onClose,
}: UIPreviewModalProps) {
  const [activePage, setActivePage] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>("mobile");

  // Clamp activePage to valid range — avoids setState-in-effect reset pattern
  const safeActivePage = pages.length > 0 ? Math.min(activePage, pages.length - 1) : 0;

  const portal = useBrowserEnv(
    ({ document }) => document.querySelector("#ui-preview-modal"),
    null,
  );

  if (!portal || !show) return null;

  const activePageData = pages[safeActivePage];

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: "rgba(2, 6, 23, 0.96)", backdropFilter: "blur(8px)" }}
    >
      {/* Sidebar */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-slate-700"
        style={{ width: 200, background: "#0f172a" }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">
            UI Preview
          </div>
        </div>

        {/* Page list */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-slate-500 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              생성 중...
            </div>
          )}
          {pages.map((page, i) => (
            <button
              key={page.pageId}
              onClick={() => setActivePage(i)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition-colors"
              style={{
                background: safeActivePage === i ? "#1d4ed8" : "transparent",
                color: safeActivePage === i ? "#fff" : "#94a3b8",
                fontWeight: safeActivePage === i ? 600 : 400,
              }}
            >
              {i + 1}. {page.pageName}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-4 flex-shrink-0 border-b border-slate-700"
          style={{ height: 48, background: "#0f172a" }}
        >
          <span className="text-sm font-semibold text-white">
            {activePageData?.pageName ?? ""}
          </span>

          {/* Viewport toggle */}
          <div className="ml-auto flex items-center gap-1">
            {(Object.keys(VIEWPORT) as ViewportSize[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewport(v)}
                title={VIEWPORT[v].label}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: viewport === v ? "#4f46e5" : "#1e293b",
                  color: viewport === v ? "#fff" : "#64748b",
                }}
              >
                {VIEWPORT_ICONS[v]}
                <span className="capitalize">{v}</span>
              </button>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview area */}
        <div
          className="flex-1 overflow-hidden flex items-center justify-center"
          style={{ background: "#1e293b", padding: 32 }}
        >
          {isLoading && (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-sm">UI 컴포넌트 생성 중...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-center max-w-sm">
              <div className="text-3xl">⚠️</div>
              <div className="text-red-400 font-semibold text-sm">생성 실패</div>
              <div className="text-slate-400 text-xs bg-red-950/40 px-4 py-2 rounded-lg">
                {error}
              </div>
            </div>
          )}

          {!isLoading && !error && activePageData && (
            <UIPreviewFrame code={activePageData.code} viewport={viewport} />
          )}

          {!isLoading && !error && pages.length === 0 && (
            <div className="text-slate-500 text-sm">페이지 없음</div>
          )}
        </div>
      </div>
    </div>,
    portal,
  );
}
