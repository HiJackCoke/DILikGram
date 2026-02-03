/**
 * WorkflowGeneratorModal - Main modal component for AI workflow generation
 *
 * Manages local state for API key and prompt, and orchestrates
 * the generation process through the context provider.
 */

import { useState } from "react";
import Modal from "@/components/Modal";
import WorkflowGeneratorView from "./View";
// import {
//   loadApiKey,
//   saveApiKey,
//   removeApiKey,
//   hasApiKey,
// } from "@/utils/localStorage";

interface WorkflowGeneratorModalProps {
  open: boolean;
  isGenerating: boolean;
  error: string | null;
  onGenerate: (prompt: string) => void;
  onClose: () => void;
}

export default function WorkflowGeneratorModal({
  open,
  isGenerating,
  error,
  onGenerate,
  onClose,
}: WorkflowGeneratorModalProps) {
  const [prompt, setPrompt] = useState("");
  // const [hasSavedKey, setHasSavedKey] = useState(() => hasApiKey());

  // Reset prompt when modal opens/closes

  // const handleSaveApiKey = (key: string) => {
  //   saveApiKey(key);
  //   setHasSavedKey(true);
  // };

  // const handleRemoveApiKey = () => {
  //   removeApiKey();
  //   setHasSavedKey(false);
  //   setApiKey("");
  // };

  const handleGenerate = () => {
    if (prompt.trim()) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <Modal
      // selector="#workflow-generator-modal"
      open={open}
      title={<WorkflowGeneratorView.Header />}
      onClose={onClose}
    >
      <WorkflowGeneratorView
        prompt={prompt}
        // hasSavedKey={hasSavedKey}
        isGenerating={isGenerating}
        error={error}
        onPromptChange={setPrompt}
        // onSaveApiKey={handleSaveApiKey}
        // onRemoveApiKey={handleRemoveApiKey}
        onGenerate={handleGenerate}
        onClose={onClose}
      />
    </Modal>
  );
}
