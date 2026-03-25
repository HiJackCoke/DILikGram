"use client";

/**
 * Dev test page for UI Preview feature
 *
 * URL: /dev/ui-preview
 *
 * Lets you verify:
 *  - generateUIAction returns correct data for each sample
 *  - iframe renders the React component code correctly
 *  - Page tab switching works
 *
 * Remove or gate behind env check before production deploy.
 */

import { useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { generateUIAction } from "@/app/_actions/ai";
import { SAMPLE_PRDS } from "@/fixtures/samples";
import type { GeneratedUIPage } from "@/types/ai/uiGeneration";
import UIPreviewFrame, { VIEWPORT } from "@/components/ui/UIPreviewFrame";
import type { ViewportSize } from "@/components/ui/UIPreviewFrame";
import Button from "@/components/ui/Button";

const VIEWPORT_ICONS: Record<ViewportSize, React.ReactNode> = {
  mobile: <Smartphone className="w-3.5 h-3.5" />,
  tablet: <Tablet className="w-3.5 h-3.5" />,
  desktop: <Monitor className="w-3.5 h-3.5" />,
};

export default function UIPreviewDevPage() {
  const [pages, setPages] = useState<GeneratedUIPage[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>("mobile");
  const [showCode, setShowCode] = useState(false);

  const addLog = (msg: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleTest = async (sampleId: string) => {
    setLoading(true);
    setActiveSample(sampleId);
    setPages([]);
    addLog(`Calling generateUIAction({ sampleId: "${sampleId}" })...`);

    try {
      const sample = SAMPLE_PRDS.find((s) => s.id === sampleId);
      if (!sample) throw new Error(`Sample not found: ${sampleId}`);

      const result = await generateUIAction({
        analysisResult: sample.analysisResult,
        nodes: sample.nodes,
        sampleId,
      });

      setPages(result.pages);
      setActivePage(0);
      addLog(
        `✅ Got ${result.pages.length} pages: ${result.pages.map((p) => p.pageName).join(", ")}`,
      );
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const activePageData = pages[activePage];

  return (
    <div className="flex h-screen font-sans bg-slate-50">
      {/* ── Sidebar ── */}
      <div className="w-[220px] bg-slate-800 flex flex-col shrink-0">
        <div className="px-4 pt-4 pb-2 text-slate-400 text-[11px] font-bold tracking-widest uppercase">
          DEV / UI PREVIEW
        </div>

        {/* Sample buttons */}
        <div className="px-2.5 pb-4 border-b border-slate-700">
          {SAMPLE_PRDS.map((s) => (
            <Button
              key={s.id}
              variant={activeSample === s.id ? "solid" : "ghost"}
              palette={activeSample === s.id ? "primary" : "neutral"}
              size="sm"
              fullWidth
              disabled={loading}
              onClick={() => handleTest(s.id)}
              className="!justify-start mb-1"
            >
              {s.emoji} {s.name}
            </Button>
          ))}
        </div>

        {/* Page tabs */}
        {pages.length > 0 && (
          <div className="px-2.5 pt-3">
            <div className="text-slate-500 text-[11px] font-bold tracking-widest uppercase mb-2 pl-1">
              Pages
            </div>
            {pages.map((p, i) => (
              <Button
                key={p.pageId}
                variant={activePage === i ? "solid" : "ghost"}
                palette={activePage === i ? "primary" : "neutral"}
                size="sm"
                fullWidth
                onClick={() => setActivePage(i)}
                className="!justify-start mb-0.5"
              >
                {i + 1}. {p.pageName}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-slate-900">
            {activePageData
              ? `${activeSample} / ${activePageData.pageName}`
              : "Select a sample →"}
          </span>

          {loading && (
            <span className="text-sm text-indigo-500">⏳ Loading...</span>
          )}

          {activePageData && (
            <div className="ml-auto flex items-center gap-1.5">
              {(Object.keys(VIEWPORT) as ViewportSize[]).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={viewport === v ? "solid" : "ghost"}
                  palette={viewport === v ? "primary" : "neutral"}
                  icon={VIEWPORT_ICONS[v]}
                  onClick={() => setViewport(v)}
                  aria-label={VIEWPORT[v].label}
                />
              ))}

              <Button
                size="sm"
                variant={showCode ? "solid" : "ghost"}
                palette="neutral"
                onClick={() => setShowCode((p) => !p)}
              >
                {"</>"}
              </Button>
            </div>
          )}
        </div>

        {/* Preview + code split */}
        <div className="flex-1 flex overflow-hidden">
          {/* iframe preview */}
          <div className="flex-1 bg-slate-200 p-6 overflow-hidden">
            {activePageData ? (
              <UIPreviewFrame code={activePageData.code} viewport={viewport} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <div className="text-5xl mb-3">📱</div>
                  <div className="text-[15px] font-semibold">
                    Select a sample to preview
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Code panel */}
          {activePageData && showCode && (
            <div className="w-[380px] bg-slate-950 overflow-auto p-4 shrink-0">
              <pre className="m-0 text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                {activePageData.code}
              </pre>
            </div>
          )}
        </div>

        {/* Log panel */}
        <div className="h-[100px] bg-slate-950 border-t border-slate-800 px-4 py-2 overflow-auto shrink-0">
          {log.length === 0 ? (
            <div className="text-slate-600 text-xs">
              Click a sample to test generateUIAction...
            </div>
          ) : (
            log.map((l, i) => (
              <div key={i} className="text-xs text-slate-400 leading-relaxed">
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
