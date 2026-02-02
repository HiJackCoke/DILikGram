/**
 * AIEditPanel - Floating panel for AI-powered node editing
 *
 * Displays a textarea for user to enter edit prompts and
 * handles submission to the AI workflow editor.
 */

import { useState } from "react";
import ReactDOM from "react-dom";

import AIEditPanelView from "./View";

import { useAIWorkflowEditor } from "@/contexts/AIWorkflowEditor";
import { useBrowserEnv } from "@/hooks/useBrowerEnv";

interface AIEditPanelProps {
  onSubmit?: (apiKey: string, nodeId: string, prompt: string) => void;
  onClose?: () => void;
}

export default function AIEditPanel({ onSubmit, onClose }: AIEditPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");

  const element = useBrowserEnv(
    ({ document }) => document.querySelector("#floating-panel-root"),
    null
  );

  const {
    state: { isOpen, nodeId, nodePosition },
    isEditing,
    error,
    close,
    update,
  } = useAIWorkflowEditor();

  const reset = () => {
    setApiKey("");
    setPrompt("");
  };

  const handleSubmit = () => {
    if (apiKey.trim() && prompt.trim() && nodeId) {
      update(apiKey.trim(), nodeId, prompt.trim());

      onSubmit?.(apiKey.trim(), nodeId, prompt.trim());

      reset();
    }
  };

  const handleClose = () => {
    close();
    onClose?.();

    reset();
  };

  if (!element || !isOpen || !nodePosition) {
    return null;
  }

  return ReactDOM.createPortal(
    <AIEditPanelView
      position={nodePosition}
      apiKey={apiKey}
      prompt={prompt}
      isEditing={isEditing}
      error={error}
      onApiKeyChange={setApiKey}
      onPromptChange={setPrompt}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />,
    element
  );
}
