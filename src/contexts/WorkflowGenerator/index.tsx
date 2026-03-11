"use client";

/**
 * WorkflowGenerator context provider
 *
 * Manages state for AI-powered workflow generation modal
 * and orchestrates the 2-step generation pipeline:
 *   Step 1: AnalyzePRD → show analysis review
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
import type {
  AnalyzePRDParams,
  AnalyzePRDResult,
} from "@/types/ai/prdAnalysis";
import {
  generateWorkflowAction,
  updateWorkflowAction,
} from "@/app/_actions/ai";
import {
  createWorkflow,
  sanitizeNewNodeIds,
  splitIntoWorkflowTrees,
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
  normalizeServiceNodes,
} from "./utils/validationUtils";
import { analyzePRD } from "@/ai";

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
  const pendingPrdContentRef = useRef<string | undefined>(undefined); // text mode: prompt (= PRD), PDF mode: undefined

  const [show, setShow] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzePRDResult | null>(
    null,
  );

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

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
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

  /**
   * Step 1: Analyze PRD → extract pages & features
   */
  const handleAnalyze = useCallback(
    async ({ pdfFiles, prompt }: AnalyzePRDParams) => {
      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult(null);

      // Persist for use in step 2
      pendingPromptRef.current = prompt ?? "";
      // Text mode: prompt is the PRD content; PDF mode: raw text not available client-side
      pendingPrdContentRef.current = pdfFiles?.length ? undefined : prompt;

      try {
        const result = await analyzePRD({
          pdfFiles,
          prompt,
        });

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

    const expectedTreeCount = analysisResult?.pages?.length ?? 1;

    setValidationProgress({
      completedValidators: 0,
      status: "validating",
      totalPages: expectedTreeCount,
      // currentPageIndex intentionally omitted → AI generation phase
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

      // ★ Split BEFORE validation so that per-tree orphan repair
      //   doesn't connect page2 nodes to page1's root
      const workflowTrees = splitIntoWorkflowTrees(sanitized);
      const treeCount = workflowTrees.length;

      const allValidatedNodes: WorkflowNode[] = [];

      for (let treeIdx = 0; treeIdx < treeCount; treeIdx++) {
        let workingNodes = [...workflowTrees[treeIdx]];

        workingNodes = await runValidationPipeline(
          {
            nodes: workingNodes,
            dialog: dialog,
            updateWorkflowAction,
          },
          (progress) => {
            setValidationProgress({
              ...progress,
              currentPageIndex: treeIdx,
              totalPages: treeCount,
            });
          },
        );

        workingNodes = normalizeServiceNodes(workingNodes);

        workingNodes = rebuildGroupChildren(workingNodes);
        workingNodes = deduplicateNodesById(workingNodes);

        allValidatedNodes.push(...workingNodes);
      }

      // Signal finalize phase before layout computation
      setValidationProgress((prev) =>
        prev ? { ...prev, status: "finalizing" } : null,
      );

      // Layout once with all trees so root nodes get distinct x positions
      const { nodes: allFinalNodes, edges: allFinalEdges } = createWorkflow(
        allValidatedNodes,
        existingNodesRef.current,
      );

      const reusableNodes = extractReusableNodes(allFinalNodes);
      if (reusableNodes.length > 0) {
        saveToNodeLibrary(reusableNodes);
        console.log(`Saved ${reusableNodes.length} reusable nodes to library`);
      }

      listeners.current.forEach((listener) =>
        listener(allFinalNodes, allFinalEdges),
      );
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
        onCancelAnalysis={clearAnalysis}
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
