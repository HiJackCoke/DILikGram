/**
 * WorkflowGenerator View Component
 *
 * Main UI layout for AI workflow generation modal
 */

import { Sparkles, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import FileUploader from "@/components/ui/FileUploader";
import PromptInput from "./PromptInput";
import InteractiveLoader from "./InteractiveLoader";
import type { ValidationProgress } from "../../../types/ai/validators";

interface WorkflowGeneratorViewProps {
  prompt: string;
  prdMode: "pdf" | "text";
  prdText: string;
  canGenerate: boolean;
  // hasSavedKey: boolean;
  isGenerating: boolean;
  error: string | null;
  validationProgress: ValidationProgress | null;
  onPromptChange: (value: string) => void;
  onPRDFileChange: (files: File[]) => void;
  onPrdModeChange: (mode: "pdf" | "text") => void;
  onPrdTextChange: (text: string) => void;
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
  prdMode,
  prdText,
  canGenerate,
  // hasSavedKey,
  isGenerating,
  error,
  validationProgress,
  onPromptChange,
  onPRDFileChange,
  onPrdModeChange,
  onPrdTextChange,
  // onSaveApiKey,
  // onRemoveApiKey,
  onGenerate,
  onClose,
}: WorkflowGeneratorViewProps) {
  return (
    <>
      <div className="p-6 space-y-6 overflow-scroll">
        {/* Header */}

        {/* PRD Document */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            PRD Document
          </label>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg bg-palette-neutral-bg p-1">
            <button
              onClick={() => onPrdModeChange("pdf")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                prdMode === "pdf"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              PDF 업로드
            </button>
            <button
              onClick={() => onPrdModeChange("text")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                prdMode === "text"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              텍스트 입력
            </button>
          </div>

          <div className="h-full content-center aspect-video md:aspect-[2/1]">
            {prdMode === "pdf" ? (
              <FileUploader
                maxFiles={2}
                accept=".pdf"
                onFileChange={onPRDFileChange}
              />
            ) : (
              <textarea
                value={prdText}
                onChange={(e) => onPrdTextChange(e.target.value)}
                placeholder="PRD 내용을 붙여넣기 하세요..."
                disabled={isGenerating}
                className="w-full h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-palette-primary-bg focus:bg-white focus:outline-none focus:ring-1 focus:ring-palette-primary-bg resize-none disabled:opacity-50"
              />
            )}
          </div>

          <p className="text-xs text-gray-500">
            PRD를 입력하면 AI가 PRD 참조와 테스트 케이스를 포함한 노드를
            생성합니다
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
            disabled={!canGenerate || isGenerating}
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
