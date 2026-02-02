'use client';

import { createContext, useState, useCallback, useRef, use } from "react";
import type { ReactNode } from "react";
import type { ExecutionConfig } from "@/types/workflow";
import ExecutorEditorModal from "@/contexts/ExecutorEditor/ExecutorEditorModal";
import type { WorkflowNodeProps } from "@/types/nodes";
import type { ExecutorEditorState, ExecutorOnSave } from "./type";

interface ExecutorEditorContextValue {
  registerOnSave: (callback: ExecutorOnSave) => void;
  open: (node: WorkflowNodeProps) => void;
  close: () => void;
}

interface ExecutorEditorProviderProps {
  children: ReactNode;
}

const ExecutorEditorContext = createContext<ExecutorEditorContextValue | null>(
  null
);

export function ExecutorEditorProvider({
  children,
}: ExecutorEditorProviderProps) {
  const listeners = useRef<ExecutorOnSave[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ExecutorEditorState | null>(null);

  const open = useCallback((node: WorkflowNodeProps) => {
    const config = node?.data?.execution?.config;

    if (!node?.type) return;

    setIsOpen(true);
    setState({
      nodeId: node.id,
      nodeType: node?.type,
      config,
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setState(null);
  }, []);

  const registerOnSave = useCallback((handler: ExecutorOnSave) => {
    listeners.current.push(handler);

    return () => {
      listeners.current = listeners.current.filter(
        (listener) => listener !== handler
      );
    };
  }, []);

  const handleSave = useCallback(
    (config: ExecutionConfig) => {
      if (!state?.nodeId) return;
      close();
      listeners.current.forEach((listener) => listener(state.nodeId, config));
    },
    [state, close]
  );

  return (
    <ExecutorEditorContext value={{ open, close, registerOnSave }}>
      {children}

      <ExecutorEditorModal
        {...state}
        key={state?.nodeId}
        open={isOpen}
        onSave={handleSave}
        onClose={close}
      />
    </ExecutorEditorContext>
  );
}

// Hook exported separately to satisfy react-refresh rules

export function useExecutorEditorContext() {
  const context = use(ExecutorEditorContext);
  if (!context) {
    throw new Error(
      "useExecutorEditorContext must be used within ExecutorEditorProvider"
    );
  }
  return context;
}
