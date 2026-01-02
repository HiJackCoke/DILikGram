/**
 * AIEditPanelView - Presentation component for AI edit panel
 *
 * Displays a floating panel with textarea, API key input, and controls
 */

import { Wand2, AlertCircle, Loader2, X } from "lucide-react";
import Button from "@/components/Button";
import type { XYPosition } from "react-cosmos-diagram";

interface AIEditPanelViewProps {
  position: XYPosition;
  apiKey: string;
  prompt: string;
  isEditing: boolean;
  error: string | null;
  onApiKeyChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function AIEditPanelView({
  position,
  apiKey,
  prompt,
  isEditing,
  error,
  onApiKeyChange,
  onPromptChange,
  onSubmit,
  onClose,
}: AIEditPanelViewProps) {
  const canSubmit = apiKey.trim() && prompt.trim() && !isEditing;

  // Calculate panel position with boundary detection
  const PANEL_WIDTH = 384; // 96 * 4 (w-96 in Tailwind)
  const PANEL_HEIGHT = 500; // Approximate height
  const OFFSET = 20; // Offset from click position
  const MARGIN = 16; // Margin from viewport edges

  let left = position.x + OFFSET;
  let top = position.y + OFFSET;

  // Boundary detection - adjust if panel would overflow viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Adjust horizontal position
  if (left + PANEL_WIDTH + MARGIN > viewportWidth) {
    left = position.x - PANEL_WIDTH - OFFSET;
  }
  if (left < MARGIN) {
    left = MARGIN;
  }

  // Adjust vertical position
  if (top + PANEL_HEIGHT + MARGIN > viewportHeight) {
    top = position.y - PANEL_HEIGHT - OFFSET;
  }
  if (top < MARGIN) {
    top = MARGIN;
  }

  const panelStyle = {
    position: "absolute" as const,
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 1001,
  };

  return (
    <div
      className="fixed inset-0 z-[999]"
      onClick={onClose}
    >
      <div
        style={panelStyle}
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-96 max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-200">
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-palette-primary-bg rounded">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Edit with AI
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Describe changes to apply to this node and its direct children
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isEditing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-..."
              disabled={isEditing}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-palette-primary-border focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Prompt Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              Edit Instructions
            </label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Example: Change the task description to 'Review design mockups' and update the assignee to 'Sarah'"
              disabled={isEditing}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-palette-primary-border focus:border-transparent resize-y disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="text-xs text-gray-500">
              AI will modify the selected node and its direct children based on
              your instructions.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-palette-danger-border shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">{error}</div>
            </div>
          )}

          {/* Loading Status */}
          {isEditing && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-4 h-4 text-palette-primary-border animate-spin" />
              <div className="text-xs text-blue-700">
                Applying changes... This may take a few seconds.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
          <Button
            palette="secondary"
            variant="outline"
            onClick={onClose}
            disabled={isEditing}
            className="text-sm"
          >
            Cancel
          </Button>
          <Button
            palette="primary"
            icon={<Wand2 className="w-3.5 h-3.5" />}
            iconPosition="left"
            onClick={onSubmit}
            disabled={!canSubmit}
            loading={isEditing}
            className="text-sm"
          >
            {isEditing ? "Editing..." : "Apply Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
