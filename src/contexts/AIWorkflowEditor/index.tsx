'use client';

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

import { updateWorkflowAction } from "@/app/actions/ai";
import { mergeWorkflow } from "@/ai/utils/workflowProcessor";
import AIEditPanel from "@/contexts/AIWorkflowEditor/AIEditPanel";

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
    async (nodeId: string, prompt: string) => {
      setIsEditing(true);
      setError(null);

      try {
        const currentNodes = currentNodesRef.current;
        // const currentEdges = currentEdgesRef.current;

        const editResult = await updateWorkflowAction(
          nodeId,
          prompt,
          currentNodes
        );

        // Step 4: Merge edit result into current workflow (ParentNode-First)
        // Context is used to derive edges from parentNode if not provided in editResult
        const { nodes, edges } = mergeWorkflow(currentNodes, editResult);

        // Step 5: Notify listeners with updated workflow
        listeners.current.forEach((listener) => listener(nodes, edges));

        // Step 6: Close panel
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
