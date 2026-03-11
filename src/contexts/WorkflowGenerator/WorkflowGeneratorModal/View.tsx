/**
 * WorkflowGenerator View Component
 *
 * Step 1 UI: PRD upload + prompt input → "분석하기"
 */

import { Search, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import FileUploader from "@/components/ui/FileUploader";
import PromptInput from "./PromptInput";
import InteractiveLoader from "./InteractiveLoader";

type Mode = "pdf" | "text";

interface WorkflowGeneratorViewProps {
  prompt: string;
  prdMode: Mode;
  canAnalyze: boolean;
  isAnalyzing: boolean;
  error: string | null;
  onPromptChange: (value: string) => void;
  onFileChange: (files: File[]) => void;
  onModeChange: (mode: Mode) => void;
  onAnalyze: () => void;
  onClose?: () => void;
}

function Header({ step }: { step?: "input" | "review" }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-palette-primary-bg rounded-lg">
        <Search className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {step === "review"
            ? "Review PRD analysis results"
            : "Generate Workflow with AI"}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {step === "review"
            ? "Check the analysis results below and create a workflow."
            : "Upload your PRD, enter the prompt, and click Analyze."}
        </p>
      </div>
    </div>
  );
}

function WorkflowGeneratorView({
  prompt,
  prdMode,
  canAnalyze,
  isAnalyzing,
  error,
  onPromptChange,
  onFileChange,
  onModeChange,
  onAnalyze,
  onClose,
}: WorkflowGeneratorViewProps) {
  return (
    <>
      <div className="p-6 space-y-6 overflow-scroll">
        {/* PRD Document */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            PRD Document
          </label>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg bg-palette-neutral-bg p-1">
            <button
              onClick={() => onModeChange("pdf")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                prdMode === "pdf"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              PDF 업로드
            </button>
            <button
              onClick={() => onModeChange("text")}
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
                onFileChange={onFileChange}
              />
            ) : (
              <textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="PRD 내용을 붙여넣기 하세요..."
                disabled={isAnalyzing}
                className="w-full h-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-palette-primary-bg focus:bg-white focus:outline-none focus:ring-1 focus:ring-palette-primary-bg resize-none disabled:opacity-50"
              />
            )}
          </div>
          <p className="text-xs text-gray-500">
            PRD를 입력하면 AI가 페이지 구조를 분석합니다
          </p>
        </div>

        {prdMode === "pdf" && (
          <>
            {prdMode === "pdf" && (
              <PromptInput
                value={prompt}
                onChange={onPromptChange}
                disabled={isAnalyzing}
              />
            )}
          </>
        )}
        {/* Prompt Input */}

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
            disabled={isAnalyzing}
          >
            Cancel
          </Button>
          <Button
            palette="primary"
            icon={<Search className="w-4 h-4" />}
            iconPosition="left"
            onClick={onAnalyze}
            disabled={!canAnalyze || isAnalyzing}
            loading={isAnalyzing}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>
      </div>
      {<InteractiveLoader progress={null} />}
    </>
  );
}

WorkflowGeneratorView.Header = Header;
export default WorkflowGeneratorView;
