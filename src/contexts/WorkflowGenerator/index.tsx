"use client";

/**
 * WorkflowGenerator context provider
 *
 * Manages state for AI-powered workflow generation modal
 * and orchestrates the generation pipeline.
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

import type {
  WorkflowGeneratorContextValue,
  RegisterOnWorkflowGenerated,
} from "./type";
import { generateWorkflowAction } from "@/app/actions/ai";
import {
  createWorkflow,
  sanitizeNewNodeIds,
} from "@/ai/utils/workflowProcessor";
import {
  loadNodeLibrary,
  saveToNodeLibrary,
  extractReusableNodes,
} from "@/utils/nodeLibrary";
import WorkflowGeneratorModal from "./WorkflowGeneratorModal";

interface WorkflowGeneratorProviderProps {
  children: ReactNode;
}

const WorkflowGeneratorContext =
  createContext<WorkflowGeneratorContextValue | null>(null);

export function WorkflowGeneratorProvider({
  children,
}: WorkflowGeneratorProviderProps) {
  const listeners = useRef<RegisterOnWorkflowGenerated[]>([]);
  const existingNodesRef = useRef<WorkflowNode[]>([]);

  const [show, setShow] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setShow(true);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setShow(false);
    setError(null);
  }, []);

  const registerOnGenerate = useCallback(
    (callback: RegisterOnWorkflowGenerated) => {
      listeners.current.push(callback);

      return () => {
        listeners.current = listeners.current.filter(
          (listener) => listener !== callback,
        );
      };
    },
    [],
  );

  const setExistingNodes = useCallback((nodes: WorkflowNode[]) => {
    existingNodesRef.current = nodes;
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string, prdText?: string) => {
      setIsGenerating(true);
      setError(null);

      try {
        // 1. Load node library
        const nodeLibrary = loadNodeLibrary();

        // 2. Call OpenAI API with PRD text and node library
        const generated = await generateWorkflowAction(
          prompt,
          prdText,
          nodeLibrary,
        );

        // 3. Process workflow (validate, layout, and map to WorkflowNode/Edge)
        const sanitized = sanitizeNewNodeIds(generated.nodes);
        const { nodes, edges } = createWorkflow(sanitized);

        // 4. Extract and save reusable nodes to library
        const reusableNodes = extractReusableNodes(nodes);
        if (reusableNodes.length > 0) {
          saveToNodeLibrary(reusableNodes);
          console.log(`Saved ${reusableNodes.length} reusable nodes to library`);
        }

        // 5. Notify listeners
        listeners.current.forEach((listener) => listener(nodes, edges));

        // 6. Close modal
        close();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate workflow";
        setError(errorMessage);
        console.error("Workflow generation error:", err);
      } finally {
        setIsGenerating(false);
      }
    },
    [close],
  );

  return (
    <WorkflowGeneratorContext
      value={{
        open,
        close,
        registerOnGenerate,
        setExistingNodes,
        isGenerating,
        error,
      }}
    >
      {children}

      <WorkflowGeneratorModal
        show={show}
        isGenerating={isGenerating}
        error={error}
        onGenerate={handleGenerate}
        onClose={close}
      />
    </WorkflowGeneratorContext>
  );
}

/**
 * Hook to access WorkflowGenerator context
 *
 * @throws Error if used outside WorkflowGeneratorProvider
 */
export function useWorkflowGenerator(handlers?: {
  onGenerate: RegisterOnWorkflowGenerated;
}): Omit<WorkflowGeneratorContextValue, "registerOnGenerate"> {
  const context = use(WorkflowGeneratorContext);
  if (!context) {
    throw new Error(
      "useWorkflowGenerator must be used within WorkflowGeneratorProvider",
    );
  }

  const { registerOnGenerate, ...rest } = context;

  useEffect(() => {
    const unregisterFns: (() => void)[] = [];

    if (handlers?.onGenerate) {
      unregisterFns.push(registerOnGenerate(handlers?.onGenerate));
    }

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }, []);

  return rest;
}
