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

interface AIEditPanelProps {
  onSubmit?: (apiKey: string, nodeId: string, prompt: string) => void;
  onClose?: () => void;
}

export default function AIEditPanel({ onSubmit, onClose }: AIEditPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");

  const {
    state: { isOpen, nodeId, nodePosition },
    isEditing,
    error,
    close,
    update,
  } = useAIWorkflowEditor();

  const handleSubmit = () => {
    if (apiKey.trim() && prompt.trim() && nodeId) {
      update(apiKey.trim(), nodeId, prompt.trim());
      onSubmit?.(apiKey.trim(), nodeId, prompt.trim());
    }
  };

  const handleClose = () => {
    setApiKey("");
    setPrompt("");
    close();
    onClose?.();
  };

  const element = document.querySelector("#floating-panel-root");

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
