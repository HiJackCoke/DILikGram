"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildSrcdoc } from "./buildSrcdoc";

export type ViewportSize = "mobile" | "tablet" | "desktop";

const VIEWPORT: Record<ViewportSize, { width: number; height: number; label: string }> = {
  mobile:  { width: 390,  height: 844,  label: "📱 Mobile"  },
  tablet:  { width: 768,  height: 1024, label: "📟 Tablet"  },
  desktop: { width: 1280, height: 800,  label: "🖥 Desktop" },
};

interface UIPreviewFrameProps {
  code: string;
  viewport?: ViewportSize;
}

export default function UIPreviewFrame({
  code,
  viewport = "mobile",
}: UIPreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);

  // Store the code that caused the error — error overlay is only shown when
  // the current code matches. This avoids both setState-in-useEffect and
  // ref-access-during-render patterns.
  const [errorEntry, setErrorEntry] = useState<{ code: string; message: string } | null>(null);
  const error = errorEntry?.code === code ? errorEntry.message : null;

  const { width, height } = VIEWPORT[viewport];

  // Listen for runtime errors relayed from iframe via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview-error") {
        setErrorEntry({ code, message: `${e.data.message} (line ${e.data.lineno})` });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [code]);

  // Scale device frame to fit container — direct DOM mutation avoids setState re-render
  useLayoutEffect(() => {
    const container = containerRef.current;
    const device = deviceRef.current;
    if (!container || !device) return;

    const observer = new ResizeObserver(([entry]) => {
      const { clientWidth, clientHeight } = entry.target as HTMLElement;
      const scale = Math.min(clientWidth / width, clientHeight / height, 1);
      device.style.transform = `scale(${scale})`;
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Device frame */}
      <div
        ref={deviceRef}
        style={{
          width,
          height,
          transformOrigin: "center center",
          borderRadius: viewport === "mobile" ? 40 : 12,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
          position: "relative",
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <iframe
          srcDoc={buildSrcdoc(code)}
          title="UI Preview"
          sandbox="allow-scripts"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        />

        {/* Error overlay */}
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15,23,42,0.92)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              gap: 12,
            }}
          >
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>
              Runtime Error
            </div>
            <div
              style={{
                color: "#fca5a5",
                fontSize: 12,
                textAlign: "center",
                fontFamily: "monospace",
                background: "rgba(239,68,68,0.1)",
                padding: "10px 16px",
                borderRadius: 8,
                maxWidth: 320,
                wordBreak: "break-word",
              }}
            >
              {error}
            </div>
            <button
              onClick={() => setErrorEntry(null)}
              style={{
                marginTop: 8,
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                color: "#e2e8f0",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { VIEWPORT };
