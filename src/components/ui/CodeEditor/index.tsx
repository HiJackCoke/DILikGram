"use client";

import { useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as prettier from "prettier/standalone";
import babelPlugin from "prettier/plugins/babel";
import estreePlugin from "prettier/plugins/estree";
import typescriptPlugin from "prettier/plugins/typescript";

interface CodeEditorProps {
  theme?: "light" | "vs-dark";
  value: string;
  language?: "javascript" | "typescript";
  readOnly?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

async function formatCode(code: string, language: "javascript" | "typescript") {
  const isTS = language === "typescript";
  return prettier.format(code, {
    parser: isTS ? "typescript" : "babel",
    plugins: isTS ? [typescriptPlugin, estreePlugin] : [babelPlugin, estreePlugin],
    semi: true,
    singleQuote: false,
    tabWidth: 2,
    printWidth: 80,
  });
}

/**
 * Shared Monaco-based code editor.
 * Auto-formats with Prettier on mount.
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
  const formatted = useRef(false);

  const handleMount: OnMount = async (editor) => {
    if (formatted.current) return;
    formatted.current = true;

    try {
      const result = await formatCode(editor.getValue(), language);
      editor.setValue(result);
      onChange?.(result);
    } catch {
      // Prettier parse error — leave code as-is
    }
  };

  return (
    <div className={`w-full h-full ${className ?? ""}`}>
      <Editor
        value={value}
        language={language}
        theme={theme}
        onMount={handleMount}
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
