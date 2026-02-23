/**
 * WorkflowGeneratorModal - Main modal component for AI workflow generation
 *
 * Manages local state for API key and prompt, and orchestrates
 * the generation process through the context provider.
 */

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import WorkflowGeneratorView from "./View";
import { ModalProps } from "@/types";
import type { ValidationProgress } from "../validators/types";
// import {
//   loadApiKey,
//   saveApiKey,
//   removeApiKey,
//   hasApiKey,
// } from "@/utils/localStorage";

interface WorkflowGeneratorModalProps
  extends Pick<ModalProps, "show" | "onClose"> {
  isGenerating: boolean;
  error: string | null;
  validationProgress: ValidationProgress | null;
  onGenerate: (prompt: string, prdText?: string) => void;
}

export default function WorkflowGeneratorModal({
  show,
  isGenerating,
  error,
  validationProgress,
  onGenerate,
  onClose,
}: WorkflowGeneratorModalProps) {
  const [prompt, setPrompt] = useState("");
  const [prdText, setPRDText] = useState("");

  const handleGenerate = () => {
    if (prompt.trim()) {
      onGenerate(prompt.trim(), prdText.trim() || undefined);
    }
  };

  return (
    <Modal
      // selector="#workflow-generator-modal"
      show={show}
      title={<WorkflowGeneratorView.Header />}
      onClose={onClose}
    >
      <WorkflowGeneratorView
        prompt={prompt}
        prdText={prdText}
        // hasSavedKey={hasSavedKey}
        isGenerating={isGenerating}
        error={error}
        validationProgress={validationProgress}
        onPromptChange={setPrompt}
        onPRDTextChange={setPRDText}
        // onSaveApiKey={handleSaveApiKey}
        // onRemoveApiKey={handleRemoveApiKey}
        onGenerate={handleGenerate}
        onClose={onClose}
      />
    </Modal>
  );
}
