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
  onGenerate: (apiKey: string, prompt: string) => void;
  onClose: () => void;
}

export default function WorkflowGeneratorModal({
  open,
  isGenerating,
  error,
  onGenerate,
  onClose,
}: WorkflowGeneratorModalProps) {
  const [apiKey, setApiKey] = useState("");
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
    if (apiKey.trim() && prompt.trim()) {
      onGenerate(apiKey.trim(), prompt.trim());
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
        apiKey={apiKey}
        prompt={prompt}
        // hasSavedKey={hasSavedKey}
        isGenerating={isGenerating}
        error={error}
        onApiKeyChange={setApiKey}
        onPromptChange={setPrompt}
        // onSaveApiKey={handleSaveApiKey}
        // onRemoveApiKey={handleRemoveApiKey}
        onGenerate={handleGenerate}
        onClose={onClose}
      />
    </Modal>
  );
}
