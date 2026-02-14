"use client";

import {
  createContext,
  useState,
  useCallback,
  useRef,
  use,
  useEffect,
} from "react";
import type { ReactNode } from "react";
import type { ExecutionConfig } from "@/types/workflow";
import ExecutorEditorModal from "@/contexts/ExecutorEditor/Modal";
import type {
  WorkflowNodeProps,
  GroupNodeData,
  WorkflowNode,
} from "@/types/nodes";
import type {
  ExecutorEditorState,
  ExecutorOnSave,
  ExecutorOnInternalNodesChange,
} from "./type";

interface ExecutorEditorContextValue {
  registerOnSave: (callback: ExecutorOnSave) => () => void;
  registerOnInternalNodesChange: (
    callback: ExecutorOnInternalNodesChange,
  ) => () => void;
  open: (node: WorkflowNodeProps) => void;
  close: () => void;
}

interface ExecutorEditorProviderProps {
  children: ReactNode;
}

const ExecutorEditorContext = createContext<ExecutorEditorContextValue | null>(
  null,
);

export function ExecutorEditorProvider({
  children,
}: ExecutorEditorProviderProps) {
  const listeners = useRef<ExecutorOnSave[]>([]);
  const internalNodesChangeListeners = useRef<ExecutorOnInternalNodesChange[]>(
    [],
  );

  const [show, setShow] = useState(false);
  const [state, setState] = useState<ExecutorEditorState | null>(null);

  const open = useCallback((node: WorkflowNodeProps) => {
    const config = node?.data?.execution?.config;

    // Extract internalNodes for group nodes
    const internalNodes =
      node?.type === "group" ? (node.data as GroupNodeData)?.groups : undefined;

    if (!node?.type) return;

    setShow(true);
    setState({
      nodeId: node.id,
      nodeType: node?.type,
      config,
      internalNodes,
    });
  }, []);

  const close = useCallback(() => {
    setShow(false);
    setState(null);
  }, []);

  const registerOnSave = useCallback((handler: ExecutorOnSave) => {
    listeners.current.push(handler);

    return () => {
      listeners.current = listeners.current.filter(
        (listener) => listener !== handler,
      );
    };
  }, []);

  const registerOnInternalNodesChange = useCallback(
    (handler: ExecutorOnInternalNodesChange) => {
      internalNodesChangeListeners.current.push(handler);

      return () => {
        internalNodesChangeListeners.current =
          internalNodesChangeListeners.current.filter(
            (listener) => listener !== handler,
          );
      };
    },
    [],
  );

  const handleSave = useCallback(
    (config: ExecutionConfig) => {
      if (!state?.nodeId) return;

      listeners.current.forEach((listener) => listener(state.nodeId, config));
    },
    [state],
  );

  const handleInternalNodesChange = useCallback(
    (nodeId: string, internalNodes: WorkflowNode[]) => {
      if (!state?.nodeId) return;
      // DON'T close modal - just notify listeners
      internalNodesChangeListeners.current.forEach((listener) =>
        listener(nodeId, internalNodes),
      );
    },
    [state],
  );

  return (
    <ExecutorEditorContext
      value={{
        open,
        close,
        registerOnSave,
        registerOnInternalNodesChange,
      }}
    >
      {children}

      <ExecutorEditorModal
        {...state}
        key={state?.nodeId}
        show={show}
        onSave={handleSave}
        onInternalNodesChange={handleInternalNodesChange}
        onClose={close}
      />
    </ExecutorEditorContext>
  );
}

// Hook exported separately to satisfy react-refresh rules

export function useExecutorEditor(handlers?: {
  onSave: ExecutorOnSave;
  onInternalNodesChange?: ExecutorOnInternalNodesChange;
}) {
  const context = use(ExecutorEditorContext);
  if (!context) {
    throw new Error(
      "useExecutorEditor must be used within ExecutorEditorProvider",
    );
  }

  const { registerOnSave, registerOnInternalNodesChange, ...rest } = context;

  useEffect(() => {
    const unregisterFns: (() => void)[] = [];

    if (handlers?.onSave) {
      unregisterFns.push(registerOnSave(handlers.onSave));
    }

    if (handlers?.onInternalNodesChange) {
      unregisterFns.push(
        registerOnInternalNodesChange(handlers.onInternalNodesChange),
      );
    }

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }, [registerOnSave, registerOnInternalNodesChange]);

  return rest;
}
