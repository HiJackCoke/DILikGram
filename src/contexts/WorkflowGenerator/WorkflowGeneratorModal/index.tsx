/**
 * WorkflowGeneratorModal - Main modal component for AI workflow generation
 *
 * Step 1 (input): User uploads PRD and enters prompt → "분석하기"
 * Step 2 (review): Show analysis result → "워크플로우 생성"
 */

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import WorkflowGeneratorView from "./View";
import AnalysisReview from "./AnalysisReview";
import InteractiveLoader from "./InteractiveLoader";
import { ModalProps } from "@/types";
import type { ValidationProgress } from "../../../types/ai/validators";
import type {
  AnalyzePRDParams,
  AnalyzePRDResult,
} from "@/types/ai/prdAnalysis";

type Step = "input" | "review";

interface WorkflowGeneratorModalProps
  extends Pick<ModalProps, "show" | "onClose"> {
  isAnalyzing: boolean;
  isGenerating: boolean;
  error: string | null;
  validationProgress: ValidationProgress | null;
  analysisResult: AnalyzePRDResult | null;
  onAnalyze: (params: AnalyzePRDParams) => void;
  onGenerate: () => void;
  onCancelAnalysis: () => void;
}

type Mode = Parameters<typeof WorkflowGeneratorView>[0]["prdMode"];

export default function WorkflowGeneratorModal({
  show,
  isAnalyzing,
  isGenerating,
  error,
  validationProgress,
  analysisResult,
  onAnalyze,
  onGenerate,
  onCancelAnalysis,
  onClose,
}: WorkflowGeneratorModalProps) {
  const step: Step = analysisResult ? "review" : "input";

  const [prompt, setPrompt] = useState("");
  const [prdFiles, setPRDFiles] = useState<File[]>([]);
  const [prdMode, setPrdMode] = useState<Mode>("pdf");

  const canAnalyze =
    prdMode === "pdf" ? prdFiles.length > 0 : prompt.trim().length > 0;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    if (prdMode === "pdf") {
      await onAnalyze({
        pdfFiles: prdFiles,
        prompt: prompt.trim(),
      });
    } else {
      await onAnalyze({
        prompt: prompt.trim(),
      });
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <Modal
      show={show}
      title={<WorkflowGeneratorView.Header step={step} />}
      onClose={handleClose}
    >
      {step === "input" && (
        <WorkflowGeneratorView
          prompt={prompt}
          prdMode={prdMode}
          canAnalyze={canAnalyze}
          isAnalyzing={isAnalyzing}
          error={error}
          onPromptChange={setPrompt}
          onFileChange={setPRDFiles}
          onModeChange={setPrdMode}
          onAnalyze={handleAnalyze}
          onClose={handleClose}
        />
      )}

      {step === "review" && analysisResult && (
        <>
          <AnalysisReview
            analysis={analysisResult}
            isGenerating={isGenerating}
            error={error}
            onGenerate={onGenerate}
            onCancel={onCancelAnalysis}
          />
          {validationProgress && (
            <InteractiveLoader progress={validationProgress} />
          )}
        </>
      )}
    </Modal>
  );
}
