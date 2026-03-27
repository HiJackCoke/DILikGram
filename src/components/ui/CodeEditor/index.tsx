"use client";

import { useEffect, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
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
  /** Called on Cmd+S / Ctrl+S */
  onSave?: () => void;
}

async function formatCode(code: string, language: "javascript" | "typescript") {
  const isTS = language === "typescript";
  return prettier.format(code, {
    parser: isTS ? "typescript" : "babel",
    plugins: isTS
      ? [typescriptPlugin, estreePlugin]
      : [babelPlugin, estreePlugin],
    // filepath hint so Prettier enables JSX support in both parsers
    filepath: isTS ? "file.tsx" : "file.jsx",
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
  onSave,
}: CodeEditorProps) {
  const formatted = useRef(false);
  // Keep a stable ref so the Cmd+S command always calls the latest onSave
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Configure TypeScript language service for React JSX (new transform).
    // This suppresses "Cannot find name 'React'" and JSX-related type errors
    // that appear when editing generated component code without full type defs.
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true, // suppress missing-import type errors
      noSyntaxValidation: false,  // keep syntax errors visible
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  };

  const handleMount: OnMount = async (editor, monaco) => {
    // Cmd+S (Mac) / Ctrl+S (Windows/Linux) → save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });

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
        beforeMount={handleBeforeMount}
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
