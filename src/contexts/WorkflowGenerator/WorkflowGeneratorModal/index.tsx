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
  onGenerate: (prompt: string, prdPDFBase64?: string) => void;
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

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    let prdPDFBase64: string | undefined;
    if (prdFile) {
      const arrayBuffer = await prdFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );
      prdPDFBase64 = `data:application/pdf;base64,${base64}`;
    }

    onGenerate(prompt.trim(), prdPDFBase64);
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
        // hasSavedKey={hasSavedKey}
        isGenerating={isGenerating}
        error={error}
        validationProgress={validationProgress}
        onPromptChange={setPrompt}
        onPRDFileChange={setPRDFile}
        // onSaveApiKey={handleSaveApiKey}
        // onRemoveApiKey={handleRemoveApiKey}
        onGenerate={handleGenerate}
        onClose={onClose}
      />
    </Modal>
  );
}
