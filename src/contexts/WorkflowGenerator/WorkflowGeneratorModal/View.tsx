/**
 * WorkflowGenerator View Component
 *
 * Main UI layout for AI workflow generation modal
 */

import { Sparkles, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import PDFUploader from "@/components/ui/PDFUploader";
import PromptInput from "./PromptInput";
import InteractiveLoader from "./InteractiveLoader";
import type { ValidationProgress } from "../../../types/ai/validators";

interface WorkflowGeneratorViewProps {
  prompt: string;
  // hasSavedKey: boolean;
  isGenerating: boolean;
  error: string | null;
  validationProgress: ValidationProgress | null;
  onPromptChange: (value: string) => void;
  onPRDFileChange: (file: File | null) => void;
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
  validationProgress,
  onPromptChange,
  onPRDFileChange,
  // onSaveApiKey,
  // onRemoveApiKey,
  onGenerate,
  onClose,
}: WorkflowGeneratorViewProps) {
  const canGenerate = prompt.trim() && !isGenerating;

  return (
    <>
      <div className="p-6 space-y-6 overflow-scroll">
        {/* Header */}

        {/* PRD Document Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            PRD Document (Optional)
          </label>
          <PDFUploader onFileSelect={onPRDFileChange} />
          <p className="text-xs text-gray-500">
            Optional: Upload PRD PDF for AI to generate nodes with PRD
            references and test cases
          </p>
        </div>

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
      {<InteractiveLoader progress={validationProgress} />}
    </>
  );
}

WorkflowGeneratorView.Header = Header;
export default WorkflowGeneratorView;
