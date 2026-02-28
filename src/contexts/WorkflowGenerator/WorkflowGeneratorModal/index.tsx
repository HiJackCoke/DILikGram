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
import type { ValidationProgress } from "../../../types/ai/validators";
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
  onGenerate: (prompt: string, prdContent?: string) => void;
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
  const [prdFile, setPRDFile] = useState<File | null>(null);
  const [prdMode, setPrdMode] = useState<"pdf" | "text">("pdf");
  const [prdText, setPrdText] = useState("");

  const canGenerate =
    prompt.trim().length > 0 &&
    (prdMode === "pdf" ? prdFile !== null : prdText.trim().length > 0);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    let prdContent: string | undefined;

    if (prdMode === "pdf" && prdFile) {
      const arrayBuffer = await prdFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );
      prdContent = `data:application/pdf;base64,${base64}`;
    } else if (prdMode === "text" && prdText.trim()) {
      prdContent = prdText.trim();
    }

    onGenerate(prompt.trim(), prdContent);
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
        prdMode={prdMode}
        prdText={prdText}
        canGenerate={canGenerate}
        // hasSavedKey={hasSavedKey}
        isGenerating={isGenerating}
        error={error}
        validationProgress={validationProgress}
        onPromptChange={setPrompt}
        onPRDFileChange={setPRDFile}
        onPrdModeChange={setPrdMode}
        onPrdTextChange={setPrdText}
        // onSaveApiKey={handleSaveApiKey}
        // onRemoveApiKey={handleRemoveApiKey}
        onGenerate={handleGenerate}
        onClose={onClose}
      />
    </Modal>
  );
}
