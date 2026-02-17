import type { PRDReference } from "@/types/prd";

interface PRDTooltipProps {
  prdRef: PRDReference;
}

export default function PRDTooltip({ prdRef }: PRDTooltipProps) {
  return (
    <div className="space-y-1.5 min-w-[220px]">
      <div>
        <div className="text-gray-400 text-[10px] uppercase tracking-wide">Section</div>
        <div className="text-white font-medium">{prdRef.section}</div>
      </div>
      <div className="border-t border-white/20 pt-1.5">
        <div className="text-gray-400 text-[10px] uppercase tracking-wide">Requirement</div>
        <div className="text-gray-200 italic">"{prdRef.requirement}"</div>
      </div>
      <div className="border-t border-white/20 pt-1.5">
        <div className="text-gray-400 text-[10px] uppercase tracking-wide">Rationale</div>
        <div className="text-gray-200">{prdRef.rationale}</div>
      </div>
    </div>
  );
}
