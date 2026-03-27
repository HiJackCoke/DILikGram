"use client";

import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  theme?: "light" | "vs-dark";
  value: string;
  language?: "javascript" | "typescript";
  readOnly?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

/**
 * Shared Monaco-based code editor.
 * Used in ExecutorEditor (functionCode) and UIPreview (page code).
 */
export default function CodeEditor({
  theme = "vs-dark",
  value,
  language = "javascript",
  readOnly = false,
  className,
  onChange,
}: CodeEditorProps) {
  return (
    <div className={`w-full h-full ${className ?? ""}`}>
      <Editor
        value={value}
        language={language}
        theme={theme}
        options={{
          readOnly,
          fontSize: 13,
          lineHeight: 20,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          renderLineHighlight: readOnly ? "none" : "line",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
          padding: { top: 12, bottom: 12 },
          fontFamily: "ui-monospace, 'Cascadia Code', Menlo, Monaco, monospace",
        }}
        onChange={(val) => onChange?.(val ?? "")}
      />
    </div>
  );
}
