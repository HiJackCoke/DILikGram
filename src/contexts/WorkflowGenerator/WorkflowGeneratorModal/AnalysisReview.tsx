/**
 * AnalysisReview - Step 2 of the 2-step workflow generation pipeline
 *
 * Displays the structured PRD analysis (pages & features) for user review
 * before triggering workflow generation.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import type { AnalyzePRDResult } from "@/types/ai/prdAnalysis";

const PRIORITY_STYLES = {
  must: "bg-red-100 text-red-700",
  should: "bg-yellow-100 text-yellow-700",
  could: "bg-gray-100 text-gray-600",
};

interface AnalysisReviewProps {
  analysis: AnalyzePRDResult;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onCancel: () => void;
}

export default function AnalysisReview({
  analysis,
  isGenerating,
  error,
  onGenerate,
  onCancel,
}: AnalysisReviewProps) {
  const [openPages, setOpenPages] = useState<Set<string>>(
    () => new Set(analysis.pages.map((p) => p.id)),
  );

  const togglePage = (pageId: string) => {
    setOpenPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
      {/* Goal */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
          Product Goal
        </p>
        <p className="text-sm text-blue-900">{analysis.goal}</p>
      </div>

      {/* Pages */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Detected Pages & Features ({analysis.pages.length} pages)
        </p>

        {analysis.pages.map((page) => {
          const isOpen = openPages.has(page.id);
          return (
            <div
              key={page.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Page header */}
              <button
                onClick={() => togglePage(page.id)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <FileText className="w-4 h-4 text-palette-primary-color shrink-0" />
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {page.name}
                </span>
                {page.path && (
                  <span className="text-xs text-gray-400 font-mono">
                    {page.path}
                  </span>
                )}
                <span className="text-xs text-gray-500 ml-2">
                  {page.features.length} features
                </span>
              </button>

              {/* Feature list */}
              {isOpen && (
                <ul className="divide-y divide-gray-100">
                  {page.features.map((feature) => (
                    <li
                      key={feature.id}
                      className="flex items-start gap-3 px-4 py-2.5"
                    >
                      <span
                        className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${PRIORITY_STYLES[feature.priority]}`}
                      >
                        {feature.priority}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {feature.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {feature.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          palette="secondary"
          variant="outline"
          onClick={onCancel}
          disabled={isGenerating}
        >
          Cancel
        </Button>
        <Button
          palette="primary"
          icon={<Sparkles className="w-4 h-4" />}
          iconPosition="left"
          onClick={onGenerate}
          disabled={isGenerating}
          loading={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Workflow"}
        </Button>
      </div>
    </div>
  );
}
