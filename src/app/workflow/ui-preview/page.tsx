"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Monitor, Tablet, Smartphone } from "lucide-react";
import { generateUIAction } from "@/app/_actions/ai";
import { SAMPLE_PRDS } from "@/fixtures/samples";
import type { GeneratedUIPage } from "@/types/ai/uiGeneration";
import UIPreviewFrame, { VIEWPORT } from "@/components/ui/UIPreviewFrame";
import type { ViewportSize } from "@/components/ui/UIPreviewFrame";
import { UI_PREVIEW_SESSION_KEY } from "@/contexts/UIPreview";

const VIEWPORT_ICONS: Record<ViewportSize, React.ReactNode> = {
  mobile: <Smartphone className="w-3.5 h-3.5" />,
  tablet: <Tablet className="w-3.5 h-3.5" />,
  desktop: <Monitor className="w-3.5 h-3.5" />,
};

export default function UIPreviewPage() {
  // null = not yet read from sessionStorage (SSR phase)
  const [storedPages, setStoredPages] = useState<GeneratedUIPage[] | null>(
    null,
  );

  // Shared state for both modes
  const [pages, setPages] = useState<GeneratedUIPage[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>("mobile");
  const [showCode, setShowCode] = useState(false);

  // Dev-mode only state
  const [loading, setLoading] = useState(false);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Read sessionStorage once on mount
  useEffect(() => {
    const raw = sessionStorage.getItem(UI_PREVIEW_SESSION_KEY);
    if (raw) {
      try {
        const parsed: GeneratedUIPage[] = JSON.parse(raw);
        setStoredPages(parsed);
        setPages(parsed);
      } catch {
        setStoredPages([]);
      }
    } else {
      setStoredPages([]);
    }
  }, []);

  const addLog = (msg: string) =>
    setLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev,
    ]);

  const handleTestSample = async (sampleId: string) => {
    setLoading(true);
    setActiveSample(sampleId);
    setPages([]);
    setActivePage(0);
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

  const handleClearAndUseSamples = () => {
    sessionStorage.removeItem(UI_PREVIEW_SESSION_KEY);
    setStoredPages([]);
    setPages([]);
    setActivePage(0);
    setActiveSample(null);
  };

  const safeActivePage = pages.length > 0 ? Math.min(activePage, pages.length - 1) : 0;
  const activePageData = pages[safeActivePage];
  const isWorkflowMode = storedPages !== null && storedPages.length > 0;

  // Still reading sessionStorage
  if (storedPages === null) return null;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
      }}
    >
      {/* ── Sidebar ── */}
      <div
        style={{
          width: 220,
          background: "#1e293b",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRight: "1px solid #334155",
        }}
      >
        {/* Back link */}
        <div
          style={{ padding: "12px 10px 8px", borderBottom: "1px solid #334155" }}
        >
          <Link
            href="/workflow"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#94a3b8",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            워크플로우로
          </Link>
        </div>

        {/* Label */}
        <div
          style={{
            padding: "10px 14px 6px",
            color: "#475569",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {isWorkflowMode ? "생성된 페이지" : "샘플 선택"}
        </div>

        {/* Workflow mode: page list */}
        {isWorkflowMode && (
          <>
            <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
              {pages.map((p, i) => (
                <button
                  key={p.pageId}
                  onClick={() => setActivePage(i)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    marginBottom: 3,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: safeActivePage === i ? 700 : 400,
                    background:
                      safeActivePage === i ? "#1d4ed8" : "transparent",
                    color: safeActivePage === i ? "#fff" : "#94a3b8",
                  }}
                >
                  {i + 1}. {p.pageName}
                </button>
              ))}
            </div>
            <div style={{ padding: "8px 10px", borderTop: "1px solid #334155" }}>
              <button
                onClick={handleClearAndUseSamples}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                샘플로 전환
              </button>
            </div>
          </>
        )}

        {/* Dev mode: sample buttons + page list */}
        {!isWorkflowMode && (
          <>
            <div
              style={{
                padding: "0 8px 12px",
                borderBottom: "1px solid #334155",
              }}
            >
              {SAMPLE_PRDS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleTestSample(s.id)}
                  disabled={loading}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    marginBottom: 4,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      activeSample === s.id ? "#3b82f6" : "#334155",
                    color: activeSample === s.id ? "#fff" : "#cbd5e1",
                  }}
                >
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>

            {pages.length > 0 && (
              <div style={{ padding: "10px 8px 0" }}>
                <div
                  style={{
                    color: "#475569",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    marginBottom: 6,
                    paddingLeft: 4,
                    textTransform: "uppercase",
                  }}
                >
                  Pages
                </div>
                {pages.map((p, i) => (
                  <button
                    key={p.pageId}
                    onClick={() => setActivePage(i)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      marginBottom: 3,
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      background:
                        safeActivePage === i ? "#1d4ed8" : "transparent",
                      color: safeActivePage === i ? "#fff" : "#94a3b8",
                    }}
                  >
                    {i + 1}. {p.pageName}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Main area ── */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Toolbar */}
        <div
          style={{
            background: "#1e293b",
            borderBottom: "1px solid #334155",
            padding: "0 16px",
            height: 48,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
            {activePageData
              ? activePageData.pageName
              : isWorkflowMode
                ? "페이지를 선택하세요"
                : "샘플을 선택하세요 →"}
          </span>

          {loading && (
            <span style={{ fontSize: 12, color: "#818cf8" }}>⏳ 생성 중...</span>
          )}

          {activePageData && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {/* Viewport toggle */}
              {(Object.keys(VIEWPORT) as ViewportSize[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewport(v)}
                  title={VIEWPORT[v].label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    background: viewport === v ? "#4f46e5" : "#334155",
                    color: viewport === v ? "#fff" : "#64748b",
                  }}
                >
                  {VIEWPORT_ICONS[v]}
                  <span style={{ textTransform: "capitalize" }}>{v}</span>
                </button>
              ))}

              {/* Code toggle */}
              <button
                onClick={() => setShowCode((p) => !p)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  background: showCode ? "#e2e8f0" : "#334155",
                  color: showCode ? "#0f172a" : "#64748b",
                }}
              >
                {"</>"}
              </button>
            </div>
          )}
        </div>

        {/* Preview + code split */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* iframe */}
          <div
            style={{
              flex: 1,
              background: "#334155",
              padding: 24,
              overflow: "hidden",
            }}
          >
            {activePageData ? (
              <UIPreviewFrame
                code={activePageData.code}
                viewport={viewport}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ textAlign: "center", color: "#475569" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>
                    {isWorkflowMode ? "페이지를 선택하세요" : "샘플을 선택하세요"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Code panel */}
          {activePageData && showCode && (
            <div
              style={{
                width: 380,
                background: "#020617",
                overflow: "auto",
                padding: 16,
                flexShrink: 0,
                borderLeft: "1px solid #1e293b",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#94a3b8",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {activePageData.code}
              </pre>
            </div>
          )}
        </div>

        {/* Log panel — only in dev mode */}
        {!isWorkflowMode && (
          <div
            style={{
              height: 90,
              background: "#020617",
              borderTop: "1px solid #1e293b",
              padding: "8px 16px",
              overflow: "auto",
              flexShrink: 0,
            }}
          >
            {log.length === 0 ? (
              <div style={{ color: "#334155", fontSize: 12 }}>
                샘플을 클릭해 generateUIAction을 테스트하세요...
              </div>
            ) : (
              log.map((l, i) => (
                <div
                  key={i}
                  style={{ fontSize: 12, color: "#64748b", lineHeight: 1.8 }}
                >
                  {l}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
