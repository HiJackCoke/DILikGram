import { NodeProps, Port, Position } from "react-cosmos-diagram";
import { GitBranch, Settings, FileText } from "lucide-react";
import type { DecisionNode } from "@/types/nodes";
import { useExecutorEditor } from "@/contexts/ExecutorEditor";
import { getDefaultPorts } from "@/utils/graph/nodes";
import PRDTooltip from "./PRDTooltip";
import Tooltip from "@/components/ui/Tooltip";

export function DecisionNode(nodeProps: NodeProps<DecisionNode>) {
  const { data, selected } = nodeProps;
  const { open } = useExecutorEditor();

  const ports = data.ports || getDefaultPorts("decision");

  // Check if execution is configured
  const hasExecutor = !!data.execution?.config?.functionCode;

  // Handle settings button click
  const handleOpenExecutorEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    open(nodeProps);
  };

  // 실행 상태에 따른 스타일
  const executionStyles = {
    executing: "scale-125 animate-pulse",
    executed: "scale-115",
    error: "scale-125",
    idle: "",
  };

  const executionRingStyles = {
    executing: "ring-4 ring-palette-warning-color",
    executed: "ring-2 ring-palette-warning-color ",
    error: "ring-4 ring-palette-danger-color border-palette-danger-border",
    idle: "",
  };

  return (
    <div className="decision-node relative group">
      {/* Diamond Shape Container */}
      <div
        className={`
          group 
          relative w-36 h-36
          transition-all duration-200
          ${data.state?.dimmed ? "opacity-30" : ""}
          ${data.execution?.error ? executionStyles.error : executionStyles[data.execution?.state || "idle"]}
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

        {/* Diamond Background */}
        <div
          className={`
            group-hover:shadow-xl group-hover:border-palette-warning-border group-hover:shadow-yellow-200
            absolute inset-0 transform rotate-45
            bg-gradient-to-br from-palette-warning-bg to-palette-warning-border
            rounded-lg shadow-lg
            border-2 transition-all duration-200
            ${
              selected
                ? "border-palette-warning-border shadow-yellow-200 shadow-xl"
                : "border-palette-warning-bg"
            }
            ${data.state?.highlighted ? "border-palette-warning-border shadow-yellow-200 shadow-xl ring-2 ring-yellow-300" : ""}
            ${data.execution?.error ? executionRingStyles.error : executionRingStyles[data.execution?.state || "idle"]}
          `}
        />

        {/* Content - stays upright */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <GitBranch className="w-6 h-6 text-yellow-900" />
              {/* PRD Reference Badge */}

              <Tooltip
                content={
                  data.prdReference && <PRDTooltip prdRef={data.prdReference} />
                }
              >
                <button
                  className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition"
                  title="PRD Reference"
                >
                  <FileText className="w-3 h-3" />
                </button>
              </Tooltip>
              {/* Executor Configuration Button */}
              <button
                disabled={data.mode === "panel"}
                onClick={handleOpenExecutorEditor}
                className={`p-1 rounded transition ${
                  hasExecutor && data.mode === "code"
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title="Configure evaluator function"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
            <div className="font-semibold text-yellow-900 text-sm max-w-[100px] truncate">
              {data.title}
            </div>
            {data.condition && Object.keys(data.condition).length > 0 && (
              <div className="text-yellow-800 text-xs mt-1 max-w-[90px] truncate opacity-80">
                {Object.entries(data.condition)
                  .map(([op, key]) => `${op.split("-")[0]} ${key}`)
                  .join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Port Labels */}
      {ports
        .filter((p) => p.label)
        .map((port) => {
          const labelPositions: Record<Position, string> = {
            [Position.Right]: `-right-[6px] top-1/2 ${selected ? "translate-x-1/2" : ""} -translate-y-1/2 ml-2`,
            [Position.Bottom]: `-bottom-[6px] left-1/2 -translate-x-1/2  ${selected ? "translate-y-1/2" : ""} mt-2`,
            [Position.Left]: `-left-[6px] top-1/2 ${selected ? "-translate-x-1/2" : ""} -translate-y-1/2 mr-2`,
            [Position.Top]: `-top-[6px] left-1/2 -translate-x-1/2  ${selected ? "-translate-y-1/2" : ""} mb-2`,
          };

          return (
            <span
              key={`label-${port.id}`}
              className={`
              transition-all duration-200
              absolute text-xs font-medium px-2 py-0.5 rounded-full
              ${labelPositions[port.position] || ""}
              ${
                port.id === "yes"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }
            `}
            >
              {port.label}
            </span>
          );
        })}
    </div>
  );
}
