/**
 * AIEditPanel - Floating panel for AI-powered node editing
 *
 * Displays a textarea for user to enter edit prompts and
 * handles submission to the AI workflow editor.
 */

import { useState } from "react";
import ReactDOM from "react-dom";

import AIEditPanelView from "./View";
import type { XYPosition } from "react-cosmos-diagram";

interface AIEditPanelProps {
  open: boolean;
  position: XYPosition | null;
  nodeId: string | null;
  isEditing: boolean;
  error: string | null;
  onSubmit: (apiKey: string, nodeId: string, prompt: string) => void;
  onClose: () => void;
}

export default function AIEditPanel({
  open,
  position,
  nodeId,
  isEditing,
  error,
  onSubmit,
  onClose,
}: AIEditPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (apiKey.trim() && prompt.trim() && nodeId) {
      onSubmit(apiKey.trim(), nodeId, prompt.trim());
    }
  };

  const handleClose = () => {
    setApiKey("");
    setPrompt("");
    onClose();
  };

  const element = document.querySelector("#floating-panel-root");

  if (!element || !open || !position) {
    return null;
  }

  return ReactDOM.createPortal(
    <AIEditPanelView
      position={position}
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
