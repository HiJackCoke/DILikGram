import { Port } from "react-cosmos-diagram";
import { Square } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

import type { ExecutionSummary, EndNodeProps } from "@/types";
import { getDefaultPorts } from "@/utils/graph/nodes";

// success: {
//   gradient: "from-palette-success-bg to-palette-success-border",
//   ring: "ring-green-300",
//   shadow: "shadow-green-200",
//   Icon: CheckCircle,
// },
// failure: {
//   gradient: "from-palette-danger-bg to-palette-danger-border",
//   ring: "ring-red-300",
//   shadow: "shadow-red-200",
//   Icon: XCircle,
// },

// Single neutral style for all END nodes
const endNodeStyle = {
  gradient: "from-palette-neutral-bg to-palette-neutral-border",
  ring: "ring-gray-300",
  shadow: "shadow-gray-200",
  Icon: Square,
};

interface ExecutionSummaryTooltipProps {
  summary: ExecutionSummary;
}

function TooltipContent({ summary }: ExecutionSummaryTooltipProps) {
  const totalNodes = summary.logs.length;
  const timeInSeconds = (summary.totalExecutionTime / 1000).toFixed(2);
  const pathPreview = summary.executedPath.slice(0, 3).join(" → ");
  const hasMore = summary.executedPath.length > 3;

  return (
    <div className="space-y-1">
      <div className="font-semibold border-b border-gray-700 pb-1 mb-1">
        Execution Summary
      </div>
      <div>
        ⏱ Total Time: <span className="font-mono">{timeInSeconds}s</span>
      </div>
      <div>
        ✅ Success:{" "}
        <span className="font-mono">
          {summary.successCount}/{totalNodes}
        </span>
      </div>
      <div className="text-xs text-gray-300">
        Path: {pathPreview}
        {hasMore && "..."}
      </div>
    </div>
  );
}

export function EndNode({ data, selected }: EndNodeProps) {
  const summary = data.execution?.summary;
  const hasSummary = !!summary;

  const { gradient, ring, shadow, Icon } = endNodeStyle;

  const ports = data.ports || getDefaultPorts("end");

  // 실행 상태에 따른 스타일
  const executionStyles = {
    executing: `ring-4 ring-palette-neutral-color animate-pulse scale-110`,
    executed: `ring-2 ring-palette-neutral-color scale-110`,
    idle: "",
  };

  // Node content

  return (
    <Tooltip
      content={hasSummary && summary && <TooltipContent summary={summary} />}
      position="bottom"
    >
      <div
        className={`
        end-node
        relative w-24 h-24 rounded-3xl
        bg-gradient-to-br ${gradient}
        flex items-center justify-center
        shadow-lg transition-all duration-200
        ${hasSummary ? "cursor-pointer" : "cursor-default"}
        ${selected ? `ring-4 ${ring} ${shadow} shadow-xl` : `hover:shadow-xl hover:${ring} hover:${shadow}`}
        ${data.state?.highlighted ? `ring-4 ${ring}` : ""}
        ${data.state?.dimmed ? "opacity-30" : ""}
        ${executionStyles[data.execution?.state || "idle"]}
      `}
      >
        {/* Ports */}
        {ports.map((port) => (
          <Port
            key={port.id}
            id={port.id}
            position={port.position}
            type={port.type}
          />
        ))}

        {/* Content */}
        <div className="text-center">
          <Icon className="w-8 h-8 text-white mx-auto mb-1" fill="white" />
          <span className="text-white font-bold text-sm">
            {data.title || "End"}
          </span>
        </div>
      </div>
    </Tooltip>
  );
}
