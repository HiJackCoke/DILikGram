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
import type { PRDAnalysisResult } from "@/types/ai/prdAnalysis";

type Step = "input" | "review";

interface WorkflowGeneratorModalProps
  extends Pick<ModalProps, "show" | "onClose"> {
  isAnalyzing: boolean;
  isGenerating: boolean;
  error: string | null;
  validationProgress: ValidationProgress | null;
  analysisResult: PRDAnalysisResult | null;
  onAnalyze: (prompt: string, prdContent: string) => void;
  onGenerate: () => void;
  onCancelAnalysis: () => void;
}

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
  const [prdMode, setPrdMode] = useState<"pdf" | "text">("pdf");
  const [prdText, setPrdText] = useState("");

  const canAnalyze =
    prompt.trim().length > 0 &&
    (prdMode === "pdf" ? prdFiles.length > 0 : prdText.trim().length > 0);

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    let prdContent: string;

    if (prdMode === "pdf" && prdFiles.length > 0) {
      const arrayBuffer = await prdFiles[0].arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );
      prdContent = `data:application/pdf;base64,${base64}`;
    } else {
      prdContent = prdText.trim();
    }

    await onAnalyze(prompt.trim(), prdContent);
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
          prdText={prdText}
          canAnalyze={canAnalyze}
          isAnalyzing={isAnalyzing}
          error={error}
          onPromptChange={setPrompt}
          onPRDFileChange={setPRDFiles}
          onPrdModeChange={setPrdMode}
          onPrdTextChange={setPrdText}
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
