/**
 * PRD Reference Tooltip
 *
 * Displays PRD reference information on hover
 * Shows section, requirement, and rationale
 */

import { FileText } from "lucide-react";
import type { PRDReference } from "@/types/prd";

interface PRDTooltipProps {
  prdRef: PRDReference;
}

export default function PRDTooltip({ prdRef }: PRDTooltipProps) {
  return (
    <div className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3 min-w-[300px] max-w-[400px] top-full mt-2 right-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-sm">PRD Reference</span>
      </div>

      {/* Section */}
      <div className="mb-2">
        <div className="text-xs font-medium text-gray-600">Section</div>
        <div className="text-sm text-gray-900 font-medium">{prdRef.section}</div>
      </div>

      {/* Requirement */}
      <div className="mb-2">
        <div className="text-xs font-medium text-gray-600">Requirement</div>
        <div className="text-sm text-gray-700 italic bg-gray-50 p-2 rounded border-l-2 border-blue-400">
          "{prdRef.requirement}"
        </div>
      </div>

      {/* Rationale */}
      <div>
        <div className="text-xs font-medium text-gray-600">Rationale</div>
        <div className="text-sm text-gray-800">{prdRef.rationale}</div>
      </div>
    </div>
  );
}
