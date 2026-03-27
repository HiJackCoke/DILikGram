"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  MessageSquare,
  Send,
  Network,
} from "lucide-react";
import { generateUIAction, refineUIPageAction } from "@/app/_actions/ai";
import type { RefineChatMessage } from "@/app/_actions/ai";
import { SAMPLE_PRDS } from "@/fixtures/samples";
import type { GeneratedUIPage } from "@/types/ai/uiGeneration";
import type { WorkflowNode } from "@/types/nodes";
import CoveragePanel from "./_components/CoveragePanel";
import UIPreviewFrame, { VIEWPORT } from "@/components/ui/UIPreviewFrame";
import type { ViewportSize } from "@/components/ui/UIPreviewFrame";
import {
  UI_PREVIEW_SESSION_KEY,
  UI_PREVIEW_VERSION_KEY,
  UI_PREVIEW_CHAT_KEY,
  UI_PREVIEW_NODES_KEY,
} from "@/contexts/UIPreview";
import { uiPreviewCache } from "@/utils/workflow/uiPreviewCache";
import Button from "@/components/ui/Button";
import CodeEditor from "@/components/ui/CodeEditor";

const VIEWPORT_ICONS: Record<ViewportSize, React.ReactNode> = {
  mobile: <Smartphone className="w-3.5 h-3.5" />,
  tablet: <Tablet className="w-3.5 h-3.5" />,
  desktop: <Monitor className="w-3.5 h-3.5" />,
};

export default function UIPreviewPage() {
  const [storedPages, setStoredPages] = useState<GeneratedUIPage[] | null>(
    null,
  );
  const [versionId, setVersionId] = useState<string | null>(null);

  const [pages, setPages] = useState<GeneratedUIPage[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>("mobile");
  const [showCode, setShowCode] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [chatHistories, setChatHistories] = useState<
    Record<string, RefineChatMessage[]>
  >({});
  const [chatInput, setChatInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [originalCodes, setOriginalCodes] = useState<Record<string, string>>(
    {},
  );

  // Per-page unsaved code edits (pageId → edited code)
  const [codeEdits, setCodeEdits] = useState<Record<string, string>>({});

  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [hoveredComponentKey, setHoveredComponentKey] = useState<string | null>(null);
  const [hoveredIsPhantom, setHoveredIsPhantom] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatHistoriesInitialized = useRef(false);

  const [loading, setLoading] = useState(false);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(UI_PREVIEW_SESSION_KEY);
    const vid = sessionStorage.getItem(UI_PREVIEW_VERSION_KEY);
    const rawChat = sessionStorage.getItem(UI_PREVIEW_CHAT_KEY);
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
    if (vid) setVersionId(vid);
    if (rawChat) {
      try {
        setChatHistories(JSON.parse(rawChat));
      } catch {
        // ignore
      }
    }
    const rawNodes = sessionStorage.getItem(UI_PREVIEW_NODES_KEY);
    if (rawNodes) {
      try { setWorkflowNodes(JSON.parse(rawNodes)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    // Skip the initial mount run — the load effect restores chatHistories from
    // sessionStorage, and we must not overwrite it with the empty initial value {}
    // before that state update is applied.
    if (!chatHistoriesInitialized.current) {
      chatHistoriesInitialized.current = true;
      return;
    }
    sessionStorage.setItem(UI_PREVIEW_CHAT_KEY, JSON.stringify(chatHistories));
  }, [chatHistories]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistories, activePage]);

  const addLog = (msg: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

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
      setWorkflowNodes(sample.nodes);
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
    sessionStorage.removeItem(UI_PREVIEW_VERSION_KEY);
    sessionStorage.removeItem(UI_PREVIEW_CHAT_KEY);
    setStoredPages([]);
    setPages([]);
    setActivePage(0);
    setActiveSample(null);
    setChatHistories({});
    setOriginalCodes({});
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isRefining || !activePageData) return;

    const pageId = activePageData.pageId;
    const currentCode = activePageData.code;

    if (!originalCodes[pageId]) {
      setOriginalCodes((prev) => ({ ...prev, [pageId]: currentCode }));
    }

    const userMsg: RefineChatMessage = { role: "user", content: trimmed };
    const prevHistory = chatHistories[pageId] ?? [];
    const nextHistory = [...prevHistory, userMsg];

    setChatHistories((prev) => ({ ...prev, [pageId]: nextHistory }));
    setChatInput("");
    if (chatInputRef.current) chatInputRef.current.style.height = "auto";
    setIsRefining(true);

    try {
      const result = await refineUIPageAction({
        currentCode,
        messages: nextHistory,
        pageName: activePageData.pageName,
      });

      const assistantMsg: RefineChatMessage = {
        role: "assistant",
        content: "UI를 업데이트했습니다.",
      };

      setChatHistories((prev) => ({
        ...prev,
        [pageId]: [...nextHistory, assistantMsg],
      }));

      const updatedPages = pages.map((p) =>
        p.pageId === pageId ? { ...p, code: result.code } : p,
      );
      setPages(updatedPages);
      sessionStorage.setItem(
        UI_PREVIEW_SESSION_KEY,
        JSON.stringify(updatedPages),
      );

      if (versionId) {
        uiPreviewCache.set(versionId, updatedPages);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "수정 실패";
      setChatHistories((prev) => ({
        ...prev,
        [pageId]: [
          ...nextHistory,
          { role: "assistant", content: `❌ 오류: ${errMsg}` },
        ],
      }));
    } finally {
      setIsRefining(false);
    }
  };

  const handleReset = () => {
    if (!activePageData) return;
    const pageId = activePageData.pageId;
    const original = originalCodes[pageId];
    if (!original) return;

    const updatedPages = pages.map((p) =>
      p.pageId === pageId ? { ...p, code: original } : p,
    );
    setPages(updatedPages);
    sessionStorage.setItem(
      UI_PREVIEW_SESSION_KEY,
      JSON.stringify(updatedPages),
    );
    if (versionId) uiPreviewCache.set(versionId, updatedPages);

    setChatHistories((prev) => ({ ...prev, [pageId]: [] }));
    setOriginalCodes((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
  };

  const handleSaveCode = () => {
    if (!activePageData) return;
    const pageId = activePageData.pageId;
    const newCode = codeEdits[pageId];
    if (!newCode || newCode === activePageData.code) return;

    const updatedPages = pages.map((p) =>
      p.pageId === pageId ? { ...p, code: newCode } : p,
    );
    setPages(updatedPages);
    sessionStorage.setItem(UI_PREVIEW_SESSION_KEY, JSON.stringify(updatedPages));
    if (versionId) uiPreviewCache.set(versionId, updatedPages);
    setCodeEdits((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
  };

  const handleDiscardCode = () => {
    if (!activePageData) return;
    setCodeEdits((prev) => {
      const next = { ...prev };
      delete next[activePageData.pageId];
      return next;
    });
  };

  const safeActivePage =
    pages.length > 0 ? Math.min(activePage, pages.length - 1) : 0;
  const activePageData = pages[safeActivePage];
  const isWorkflowMode = storedPages !== null && storedPages.length > 0;
  const activePageId = activePageData?.pageId ?? "";
  const activeHistory = chatHistories[activePageId] ?? [];
  const hasOriginal = !!originalCodes[activePageId];
  const activeEditorCode = codeEdits[activePageId] ?? activePageData?.code ?? "";
  const isCodeDirty =
    activePageData !== undefined &&
    codeEdits[activePageId] !== undefined &&
    codeEdits[activePageId] !== activePageData.code;

  if (storedPages === null) return null;

  return (
    <div className="flex h-screen font-sans bg-slate-950">
      {/* ── Sidebar ── */}
      <div className="w-[220px] bg-slate-800 flex flex-col shrink-0 border-r border-slate-700">
        {/* Back link */}
        <div className="px-2.5 pt-3 pb-2 border-b border-slate-700">
          <Link
            href="/workflow"
            className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold no-underline hover:text-slate-300 transition-colors"
          >
            <ArrowLeft size={14} />
            To. Workflow
          </Link>
        </div>

        {/* Label */}
        <div className="px-3.5 pt-2.5 pb-1.5 text-slate-600 text-[10px] font-bold tracking-[1.5px] uppercase">
          {isWorkflowMode ? "생성된 페이지" : "샘플 선택"}
        </div>

        {/* Workflow mode: page list */}
        {isWorkflowMode && (
          <>
            <div className="flex-1 overflow-auto px-2 pb-2">
              {pages.map((p, i) => (
                <Button
                  key={p.pageId}
                  variant={safeActivePage === i ? "solid" : "ghost"}
                  palette={safeActivePage === i ? "primary" : "neutral"}
                  size="sm"
                  fullWidth
                  onClick={() => setActivePage(i)}
                  className="!justify-start mb-0.5"
                >
                  {i + 1}. {p.pageName}
                  {chatHistories[p.pageId]?.length ? (
                    <span className="ml-1.5 text-indigo-400 text-[10px]">
                      ●
                    </span>
                  ) : null}
                </Button>
              ))}
            </div>
            <div className="p-2 border-t border-slate-700">
              <Button
                variant="outline"
                palette="neutral"
                size="sm"
                fullWidth
                onClick={handleClearAndUseSamples}
              >
                샘플로 전환
              </Button>
            </div>
          </>
        )}

        {/* Dev mode: sample buttons + page list */}
        {!isWorkflowMode && (
          <>
            <div className="px-2 pb-3 border-b border-slate-700">
              {SAMPLE_PRDS.map((s) => (
                <Button
                  key={s.id}
                  variant={activeSample === s.id ? "solid" : "ghost"}
                  palette={activeSample === s.id ? "primary" : "neutral"}
                  size="sm"
                  fullWidth
                  disabled={loading}
                  onClick={() => handleTestSample(s.id)}
                  className="!justify-start mb-1"
                >
                  {s.emoji} {s.name}
                </Button>
              ))}
            </div>

            {pages.length > 0 && (
              <div className="px-2 pt-2.5">
                <div className="text-slate-600 text-[10px] font-bold tracking-widest uppercase mb-1.5 pl-1">
                  Pages
                </div>
                {pages.map((p, i) => (
                  <Button
                    key={p.pageId}
                    variant={safeActivePage === i ? "solid" : "ghost"}
                    palette={safeActivePage === i ? "primary" : "neutral"}
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
          </>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 h-12 flex items-center gap-3 shrink-0">
          <span className="text-[13px] font-bold text-slate-200">
            {activePageData
              ? activePageData.pageName
              : isWorkflowMode
                ? "페이지를 선택하세요"
                : "샘플을 선택하세요 →"}
          </span>

          {loading && (
            <span className="text-xs text-indigo-400">⏳ 생성 중...</span>
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
                variant={showChat ? "solid" : "ghost"}
                palette={showChat ? "success" : "neutral"}
                icon={<MessageSquare className="w-3.5 h-3.5" />}
                onClick={() => {
                  setShowChat((p) => !p);
                  setShowCode(false);
                }}
              >
                AI 수정
              </Button>

              <Button
                size="sm"
                variant={showCoverage ? "solid" : "ghost"}
                palette={showCoverage ? "primary" : "neutral"}
                icon={<Network className="w-3.5 h-3.5" />}
                onClick={() => setShowCoverage((p) => !p)}
              >
                Coverage
              </Button>

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

        {/* Preview + right panel split */}
        <div className="flex-1 flex overflow-hidden">
          {/* iframe */}
          <div className="flex-1 bg-slate-700 p-6 overflow-hidden">
            {activePageData ? (
              <UIPreviewFrame
                code={activePageData.code}
                viewport={viewport}
                highlightComponentKey={hoveredComponentKey ?? undefined}
                highlightIsPhantom={hoveredIsPhantom}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-slate-600">
                  <div className="text-5xl mb-3">📱</div>
                  <div className="text-[15px] font-semibold text-slate-500">
                    {isWorkflowMode
                      ? "페이지를 선택하세요"
                      : "샘플을 선택하세요"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Code panel */}
          {activePageData && showCode && (
            <div className="w-[420px] shrink-0 border-l border-slate-800 flex flex-col">
              {/* Code panel header */}
              <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Code</span>
                  {isCodeDirty && (
                    <span className="text-[10px] text-amber-400 font-medium">● unsaved</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    palette="neutral"
                    disabled={!isCodeDirty}
                    onClick={handleDiscardCode}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="solid"
                    palette="primary"
                    disabled={!isCodeDirty}
                    onClick={handleSaveCode}
                  >
                    Apply & Save
                  </Button>
                </div>
              </div>
              <CodeEditor
                value={activeEditorCode}
                language="typescript"
                className="flex-1"
                onChange={(val) =>
                  setCodeEdits((prev) => ({ ...prev, [activePageId]: val }))
                }
                onSave={handleSaveCode}
              />
            </div>
          )}

          {/* Coverage panel */}
          {activePageData && showCoverage && (
            <CoveragePanel
              components={activePageData.components ?? []}
              workflowNodes={workflowNodes}
              pageName={activePageData.pageName}
              onHoverComponent={(key, isPhantom) => {
                setHoveredComponentKey(key);
                setHoveredIsPhantom(isPhantom ?? false);
              }}
            />
          )}

          {/* Chat panel */}
          {activePageData && showChat && (
            <div className="w-[360px] bg-slate-950 flex flex-col shrink-0 border-l border-slate-800">
              {/* Chat header */}
              <div className="px-3.5 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  AI UI 수정
                </span>
                {hasOriginal && (
                  <Button
                    size="sm"
                    variant="ghost"
                    palette="neutral"
                    icon={<RotateCcw size={11} />}
                    onClick={handleReset}
                    aria-label="원본으로 되돌리기"
                  >
                    원본으로
                  </Button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto px-3.5 py-3 flex flex-col gap-2.5">
                {activeHistory.length === 0 && (
                  <div className="text-slate-700 text-xs text-center mt-10">
                    수정하고 싶은 내용을 입력하세요.
                    <span className="text-slate-800 text-[11px] mt-2 block">
                      예: &quot;카드 색상을 초록색으로 바꿔줘&quot;
                      <br />
                      예: &quot;필터 칩 추가해줘&quot;
                    </span>
                  </div>
                )}
                {activeHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed break-words ${
                        msg.role === "user"
                          ? "bg-blue-700 text-white rounded-[12px_12px_2px_12px]"
                          : "bg-slate-800 text-slate-400 rounded-[12px_12px_12px_2px]"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isRefining && (
                  <div className="flex items-start">
                    <div className="px-3 py-2 rounded-[12px_12px_12px_2px] bg-slate-800 text-indigo-400 text-xs">
                      ⏳ 수정 중...
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2.5 border-t border-slate-800 flex items-end gap-2">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  rows={1}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="수정 내용을 입력하세요..."
                  disabled={isRefining}
                  className="flex-1 resize-none overflow-hidden bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-50 focus:border-slate-500 transition-colors"
                />
                <Button
                  size="sm"
                  variant="solid"
                  palette="primary"
                  icon={<Send className="w-3 h-3" />}
                  disabled={isRefining || !chatInput.trim()}
                  onClick={handleSendChat}
                  aria-label="전송"
                />
              </div>
            </div>
          )}
        </div>

        {/* Log panel — only in dev mode */}
        {!isWorkflowMode && (
          <div className="h-[90px] bg-slate-950 border-t border-slate-800 px-4 py-2 overflow-auto shrink-0">
            {log.length === 0 ? (
              <div className="text-slate-700 text-xs">
                샘플을 클릭해 generateUIAction을 테스트하세요...
              </div>
            ) : (
              log.map((l, i) => (
                <div key={i} className="text-xs text-slate-500 leading-relaxed">
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
