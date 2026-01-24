/**
 * AIWorkflowEditor context provider
 *
 * Manages state for AI-powered workflow editing panel
 * and orchestrates the edit pipeline.
 */

import {
  createContext,
  useState,
  useCallback,
  useRef,
  use,
  useEffect,
} from "react";
import type { ReactNode } from "react";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/edges";

import type {
  AIWorkflowEditorContextValue,
  AIWorkflowEditorHandlers,
  AIWorkflowEditorState,
  OnWorkflowEditCallback,
} from "./type";

import AIEditPanel from "@/components/AIEditPanel";

interface AIWorkflowEditorProviderProps {
  children: ReactNode;
}

const AIWorkflowEditorContext =
  createContext<AIWorkflowEditorContextValue | null>(null);

export function AIWorkflowEditorProvider({
  children,
}: AIWorkflowEditorProviderProps) {
  const [state, setState] = useState<AIWorkflowEditorState>({
    isOpen: false,
    nodeId: null,
    nodePosition: null,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listeners = useRef<OnWorkflowEditCallback[]>([]);
  const currentNodesRef = useRef<WorkflowNode[]>([]);
  const currentEdgesRef = useRef<WorkflowEdge[]>([]);

  const open = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setState({
        isOpen: true,
        nodeId,
        nodePosition: position,
      });
      setError(null);
    },
    []
  );

  const close = useCallback(() => {
    setState({
      isOpen: false,
      nodeId: null,
      nodePosition: null,
    });
    setError(null);
  }, []);

  const registerOnEdit = useCallback((callback: OnWorkflowEditCallback) => {
    listeners.current.push(callback);

    return () => {
      listeners.current = listeners.current.filter(
        (listener) => listener !== callback
      );
    };
  }, []);

  const setCurrentWorkflow = useCallback(
    (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
      currentNodesRef.current = nodes;
      currentEdgesRef.current = edges;
    },
    []
  );

  const update = useCallback(
    async (apiKey: string, nodeId: string, prompt: string) => {
      setIsEditing(true);
      setError(null);

      try {
        // TODO: Implement in Stage 2
        // This is a placeholder for now
        console.log("Edit request:", { apiKey, nodeId, prompt });

        // Simulate edit completion
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // For now, just notify listeners with current workflow
        listeners.current.forEach((listener) =>
          listener(currentNodesRef.current, currentEdgesRef.current)
        );

        close();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to edit workflow";
        setError(errorMessage);
        console.error("Workflow edit error:", err);
      } finally {
        setIsEditing(false);
      }
    },
    [close]
  );

  return (
    <AIWorkflowEditorContext
      value={{
        state,
        isEditing,
        error,
        open,
        close,
        registerOnEdit,
        setCurrentWorkflow,
        update,
      }}
    >
      {children}
      <div id="floating-panel-root" />
      <AIEditPanel />
    </AIWorkflowEditorContext>
  );
}

/**
 * Hook to access AIWorkflowEditor context
 *
 * @throws Error if used outside AIWorkflowEditorProvider
 */
export function useAIWorkflowEditor(
  handlers?: AIWorkflowEditorHandlers
): AIWorkflowEditorContextValue {
  const context = use(AIWorkflowEditorContext);
  if (!context) {
    throw new Error(
      "useAIWorkflowEditor must be used within AIWorkflowEditorProvider"
    );
  }

  const { registerOnEdit } = context;

  useEffect(() => {
    const unregisterFns: (() => void)[] = [];

    if (handlers?.onEdit) {
      unregisterFns.push(registerOnEdit(handlers.onEdit));
    }

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return context;
}
