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
import WorkflowGeneratorModal from "./WorkflowGeneratorModal";
import { runValidationPipeline } from "./validators";

import { analyzePRD } from "@/ai";
import { getSampleById } from "@/fixtures/samples";

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
  const selectedSampleIdRef = useRef<string | null>(null);

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
    selectedSampleIdRef.current = null;
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
   * If pdfFiles contains a synthetic sample file (name starts with "sample:"),
   * bypass API and use pre-sampled analysis result.
   */
  const handleAnalyze = useCallback(
    async ({ pdfFiles, prompt }: AnalyzePRDParams) => {
      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult(null);

      // Sample bypass: detect synthetic file "sample:{id}" created by sample card click
      const sampleFile = pdfFiles?.[0];
      const sampleId = sampleFile?.name.startsWith("sample:")
        ? sampleFile.name.slice("sample:".length)
        : null;

      if (sampleId) {
        const sample = getSampleById(sampleId);
        if (!sample) {
          setError(`Sample not found: ${sampleId}`);
          setIsAnalyzing(false);
          return;
        }
        selectedSampleIdRef.current = sampleId;
        pendingPromptRef.current = "";
        // Simulate PDF parsing + AI analysis time (2.5s feels realistic)
        await new Promise((resolve) => setTimeout(resolve, 2500));
        setAnalysisResult(sample.analysisResult);
        setIsAnalyzing(false);
        return;
      }

      // Persist for use in step 2
      selectedSampleIdRef.current = null;
      pendingPromptRef.current = prompt ?? "";

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
   * If sample was selected in step 1, bypass API + validation and use pre-sampled nodes.
   */
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    // Sample bypass: skip API + validation, use pre-sampled nodes directly
    if (selectedSampleIdRef.current) {
      const sample = getSampleById(selectedSampleIdRef.current);
      if (sample) {
        const totalPages = sample.analysisResult.pages.length;

        try {
          // Phase 1: AI generation phase (~2s) — no currentPageIndex shown in loader
          setValidationProgress({
            completedValidators: 0,
            status: "validating",
            totalPages,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Phase 2: Per-page validation simulation
          // Ramp completedValidators 0→18 over ~1.2s per page
          const TOTAL_VALIDATORS = 18;
          const STEPS_PER_PAGE = 6; // checkpoint counts shown in loader
          const STEP_DELAY = Math.round(1200 / STEPS_PER_PAGE);

          for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            for (let step = 0; step <= STEPS_PER_PAGE; step++) {
              const completedValidators = Math.round(
                (step / STEPS_PER_PAGE) * TOTAL_VALIDATORS,
              );
              setValidationProgress({
                completedValidators,
                status: "validating",
                currentPageIndex: pageIdx,
                totalPages,
              });
              await new Promise((resolve) => setTimeout(resolve, STEP_DELAY));
            }
          }

          // Phase 3: Finalizing
          setValidationProgress((prev) =>
            prev ? { ...prev, status: "finalizing" } : null,
          );
          await new Promise((resolve) => setTimeout(resolve, 600));

          const sanitized = sanitizeNewNodeIds(sample.nodes);
          const { nodes: allFinalNodes, edges: allFinalEdges } = createWorkflow(
            sanitized,
            existingNodesRef.current,
          );

          const sampleMeta = {
            analysisResult: sample.analysisResult,
            sampleId: selectedSampleIdRef.current,
          };
          listeners.current.forEach((listener) =>
            listener(allFinalNodes, allFinalEdges, sampleMeta),
          );
          close();
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to load sample workflow";
          setError(errorMessage);
        } finally {
          setIsGenerating(false);
          setValidationProgress(null);
        }
        return;
      }
    }

    const expectedTreeCount = analysisResult?.pages?.length ?? 1;

    setValidationProgress({
      completedValidators: 0,
      status: "validating",
      totalPages: expectedTreeCount,
      // currentPageIndex intentionally omitted → AI generation phase
    });

    try {
      const generated = await generateWorkflowAction({
        prompt: pendingPromptRef.current,
        analysisResult,
      });

      console.log("generated", generated);
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

        // workingNodes = normalizeServiceNodes(workingNodes);
        // workingNodes = rebuildGroupChildren(workingNodes);
        // workingNodes = deduplicateNodesById(workingNodes);

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

      const generationMeta = {
        analysisResult: analysisResult!,
        sampleId: selectedSampleIdRef.current,
      };
      listeners.current.forEach((listener) =>
        listener(allFinalNodes, allFinalEdges, generationMeta),
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
        isOpen: show,
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
