"use client";

/**
 * WorkflowGenerator context provider
 *
 * Manages state for AI-powered workflow generation modal
 * and orchestrates the 2-step generation pipeline:
 *   Step 1: analyzePRDAction → show analysis review
 *   Step 2: generateWorkflowAction (with analysis result) → add to canvas
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
import type { ValidationProgress } from "../../types/ai/validators";
import type { PRDAnalysisResult } from "@/types/ai/prdAnalysis";
import {
  analyzePRDAction,
  generateWorkflowAction,
  updateWorkflowAction,
} from "@/app/actions/ai";
import {
  createWorkflow,
  sanitizeNewNodeIds,
} from "@/utils/ai/workflowProcessor";
import {
  loadNodeLibrary,
  saveToNodeLibrary,
  extractReusableNodes,
} from "@/utils/nodeLibrary";
import WorkflowGeneratorModal from "./WorkflowGeneratorModal";
import { runValidationPipeline } from "./validators";
import {
  rebuildGroupChildren,
  deduplicateNodesById,
} from "./utils/validationUtils";

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

  // Persisted across both steps so handleGenerate can use them
  const pendingPromptRef = useRef<string>("");
  const pendingPrdContentRef = useRef<string | undefined>(undefined);

  const [show, setShow] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<PRDAnalysisResult | null>(null);

  const open = useCallback(() => {
    setShow(true);
    setError(null);
    setAnalysisResult(null);
  }, []);

  const close = useCallback(() => {
    setShow(false);
    setError(null);
    setAnalysisResult(null);
    pendingPromptRef.current = "";
    pendingPrdContentRef.current = undefined;
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

  /**
   * Step 1: Analyze PRD → extract pages & features
   */
  const handleAnalyze = useCallback(
    async (prompt: string, prdContent: string) => {
      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult(null);

      // Persist for use in step 2
      pendingPromptRef.current = prompt;
      pendingPrdContentRef.current = prdContent;

      try {
        const result = await analyzePRDAction(prdContent, prompt);
        setAnalysisResult(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "PRD 분석에 실패했습니다";
        setError(errorMessage);
        console.error("PRD analysis error:", err);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  /**
   * Step 2: Generate workflow using analysis result + original PRD
   */
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    setValidationProgress({
      currentValidator: "AI Generation",
      totalValidators: 7,
      completedValidators: 0,
      status: "validating",
      message: "Generating workflow with AI...",
      currentStep: 1,
      totalSteps: 8,
    });

    try {
      const nodeLibrary = loadNodeLibrary();

      const generated = await generateWorkflowAction(
        pendingPromptRef.current,
        pendingPrdContentRef.current,
        nodeLibrary,
        analysisResult ?? undefined,
      );

      const sanitized = sanitizeNewNodeIds(generated.nodes);
      let workingNodes = [...sanitized];

      workingNodes = await runValidationPipeline(
        {
          nodes: workingNodes,
          dialog: dialog,
          updateWorkflowAction,
        },
        (progress) => {
          setValidationProgress({
            ...progress,
            currentStep: progress.completedValidators + 2,
            totalSteps: 8,
          });
        },
      );

      workingNodes = rebuildGroupChildren(workingNodes);
      workingNodes = deduplicateNodesById(workingNodes);

      const { nodes, edges } = createWorkflow(
        workingNodes,
        existingNodesRef.current,
      );

      const reusableNodes = extractReusableNodes(nodes);
      if (reusableNodes.length > 0) {
        saveToNodeLibrary(reusableNodes);
        console.log(`Saved ${reusableNodes.length} reusable nodes to library`);
      }

      listeners.current.forEach((listener) => listener(nodes, edges));
      close();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate workflow";
      setError(errorMessage);
      console.error("Workflow generation error:", err);
    } finally {
      setIsGenerating(false);
      setValidationProgress(null);
    }
  }, [close, analysisResult]);

  return (
    <WorkflowGeneratorContext
      value={{
        open,
        close,
        registerOnGenerate,
        setExistingNodes,
        isGenerating,
        error,
        validationProgress,
      }}
    >
      {children}

      <WorkflowGeneratorModal
        show={show}
        isAnalyzing={isAnalyzing}
        isGenerating={isGenerating}
        error={error}
        validationProgress={validationProgress}
        analysisResult={analysisResult}
        onAnalyze={handleAnalyze}
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
