/**
 * WorkflowGenerator View Component
 *
 * Main UI layout for AI workflow generation modal
 */

import { Sparkles, AlertCircle, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import PromptInput from "./PromptInput";

interface WorkflowGeneratorViewProps {
  prompt: string;
  // hasSavedKey: boolean;
  isGenerating: boolean;
  error: string | null;
  onPromptChange: (value: string) => void;
  // onSaveApiKey: (key: string) => void;
  // onRemoveApiKey: () => void;
  onGenerate: () => void;
  onClose?: () => void;
}

function Header() {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-palette-primary-bg rounded-lg">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Generate Workflow with AI
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Describe your workflow in natural language and let AI create nodes and
          connections for you.
        </p>
      </div>
    </div>
  );
}

function WorkflowGeneratorView({
  prompt,
  // hasSavedKey,
  isGenerating,
  error,
  onPromptChange,
  // onSaveApiKey,
  // onRemoveApiKey,
  onGenerate,
  onClose,
}: WorkflowGeneratorViewProps) {
  const canGenerate = prompt.trim() && !isGenerating;

  return (
    <div className="p-6 space-y-6 overflow-scroll">
      {/* Header */}

      {/* Prompt Input */}
      <PromptInput
        value={prompt}
        onChange={onPromptChange}
        disabled={isGenerating}
      />

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-palette-danger-border shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Generating Status */}
      {isGenerating && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Loader2 className="w-4 h-4 text-palette-primary-border animate-spin" />
          <div className="text-sm text-white">
            Generating your workflow... This may take a few seconds.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          palette="secondary"
          variant="outline"
          onClick={onClose}
          disabled={isGenerating}
        >
          Cancel
        </Button>
        <Button
          palette="primary"
          icon={<Sparkles className="w-4 h-4" />}
          iconPosition="left"
          onClick={onGenerate}
          disabled={!canGenerate}
          loading={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Workflow"}
        </Button>
      </div>
    </div>
  );
}

WorkflowGeneratorView.Header = Header;
export default WorkflowGeneratorView;
