'use client';

/**
 * WorkflowGenerator context provider
 *
 * Manages state for AI-powered workflow generation modal
 * and orchestrates the generation pipeline.
 */

import { createContext, useState, useCallback, useRef, use } from "react";
import type { ReactNode } from "react";
import type { WorkflowNode } from "@/types/nodes";

import type {
  WorkflowGeneratorContextValue,
  RegisterOnWorkflowGenerated,
} from "./type";
import { generateWorkflow } from "@/ai/utils/aiClient";
import {
  createWorkflow,
  // parseWorkflowFromAI,
} from "@/ai/utils/workflowProcessor";
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

  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const registerOnGenerate = useCallback(
    (callback: RegisterOnWorkflowGenerated) => {
      listeners.current.push(callback);

      return () => {
        listeners.current = listeners.current.filter(
          (listener) => listener !== callback
        );
      };
    },
    []
  );

  const setExistingNodes = useCallback((nodes: WorkflowNode[]) => {
    existingNodesRef.current = nodes;
  }, []);

  const handleGenerate = useCallback(
    async (apiKey: string, prompt: string) => {
      setIsGenerating(true);
      setError(null);

      try {
        // 1. Call OpenAI API
        const generated = await generateWorkflow({
          apiKey,
          prompt,
        });

        // 2. Process workflow (validate, layout, and map to WorkflowNode/Edge)
        const { nodes, edges } = createWorkflow(generated.nodes);

        // 3. Notify listeners
        listeners.current.forEach((listener) => listener(nodes, edges));

        // 4. Close modal
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
    [close]
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
        open={isOpen}
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
export function useWorkflowGenerator(): WorkflowGeneratorContextValue {
  const context = use(WorkflowGeneratorContext);
  if (!context) {
    throw new Error(
      "useWorkflowGenerator must be used within WorkflowGeneratorProvider"
    );
  }
  return context;
}
