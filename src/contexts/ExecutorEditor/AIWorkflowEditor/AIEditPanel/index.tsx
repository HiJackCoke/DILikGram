/**
 * AIEditPanel - Floating panel for AI-powered node editing
 *
 * Displays a textarea for user to enter edit prompts and
 * handles submission to the AI workflow editor.
 */

import { useState } from "react";
import ReactDOM from "react-dom";

import AIEditPanelView from "./View";

import { useAIWorkflowEditor } from "@/contexts/ExecutorEditor/AIWorkflowEditor";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";

interface AIEditPanelProps {
  onSubmit?: (nodeId: string, prompt: string) => void;
  onClose?: () => void;
}

export default function AIEditPanel({ onSubmit, onClose }: AIEditPanelProps) {
  const [prompt, setPrompt] = useState("");

  const element = useBrowserEnv(
    ({ document }) => document.querySelector("#floating-panel-root"),
    null,
  );

  const {
    state: { isOpen, nodeId, nodePosition },
    isEditing,
    error,
    close,
    update,
  } = useAIWorkflowEditor();

  const reset = () => {
    setPrompt("");
  };

  const handleSubmit = () => {
    if (prompt.trim() && nodeId) {
      update(nodeId, prompt.trim());

      onSubmit?.(nodeId, prompt.trim());

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
      prompt={prompt}
      isEditing={isEditing}
      error={error}
      onPromptChange={setPrompt}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />,
    element,
  );
}
