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
import { generateUIAction } from "@/app/_actions/ai";
import { SAMPLE_PRDS } from "@/fixtures/samples";
import type { GeneratedUIPage } from "@/types/ai/uiGeneration";

export default function UIPreviewDevPage() {
  const [pages, setPages] = useState<GeneratedUIPage[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [activeSample, setActiveSample] = useState<string | null>(null);

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
      addLog(`✅ Got ${result.pages.length} pages: ${result.pages.map((p) => p.pageName).join(", ")}`);
    } catch (err) {
      addLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const activePageData = pages[activePage];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#1e293b", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 8px", color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          DEV / UI PREVIEW
        </div>

        {/* Sample buttons */}
        <div style={{ padding: "0 10px 16px", borderBottom: "1px solid #334155" }}>
          {SAMPLE_PRDS.map((s) => (
            <button key={s.id} onClick={() => handleTest(s.id)} disabled={loading}
              style={{ width: "100%", textAlign: "left", padding: "9px 12px", marginBottom: 4, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeSample === s.id ? "#3b82f6" : "#334155", color: activeSample === s.id ? "#fff" : "#cbd5e1", transition: "all 0.15s" }}>
              {s.emoji} {s.name}
            </button>
          ))}
        </div>

        {/* Page tabs */}
        {pages.length > 0 && (
          <div style={{ padding: "12px 10px 0" }}>
            <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>PAGES</div>
            {pages.map((p, i) => (
              <button key={p.pageId} onClick={() => setActivePage(i)}
                style={{ width: "100%", textAlign: "left", padding: "8px 12px", marginBottom: 3, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, background: activePage === i ? "#1d4ed8" : "transparent", color: activePage === i ? "#fff" : "#94a3b8" }}>
                {i + 1}. {p.pageName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
            {activePageData ? `${activeSample} / ${activePageData.pageName}` : "Select a sample →"}
          </span>
          {loading && <span style={{ fontSize: 13, color: "#6366f1" }}>⏳ Loading...</span>}
          {activePageData && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
              {activePageData.code.length.toLocaleString()} chars
            </span>
          )}
        </div>

        {/* Preview + code split */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* iframe preview */}
          <div style={{ flex: 1, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {activePageData ? (
              <iframe
                style={{ width: 390, height: "90%", maxHeight: 844, border: "none", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", background: "#fff" }}
                title="preview"
                // srcdoc will be added in Phase 2 when UIPreviewFrame is built
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;font-family:system-ui"><div style="background:#fff;padding:32px;border-radius:12px;text-align:center;color:#64748b"><div style="font-size:32px">🔧</div><div style="font-size:15px;font-weight:600;margin-top:12px">iframe renderer</div><div style="font-size:13px;margin-top:6px">Built in Phase 2</div></div></body></html>`}
              />
            ) : (
              <div style={{ textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Select a sample to preview</div>
              </div>
            )}
          </div>

          {/* Code panel */}
          {activePageData && (
            <div style={{ width: 380, background: "#0f172a", overflow: "auto", padding: "16px" }}>
              <pre style={{ margin: 0, fontSize: 11, color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {activePageData.code}
              </pre>
            </div>
          )}
        </div>

        {/* Log panel */}
        <div style={{ height: 100, background: "#0f172a", borderTop: "1px solid #1e293b", padding: "8px 16px", overflow: "auto" }}>
          {log.length === 0 ? (
            <div style={{ color: "#475569", fontSize: 12 }}>Click a sample to test generateUIAction...</div>
          ) : (
            log.map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>{l}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
