import { Port, Position } from "react-cosmos-diagram";
import { GitBranch, Settings } from "lucide-react";
import type {
  DecisionNodeProps,
  NodePort,
  WorkflowNodeProps,
} from "@/types/nodes";
import { useExecutorEditorContext } from "@/contexts/ExecutorEditor";

export function DecisionNode(nodeProps: DecisionNodeProps) {
  const { data, selected } = nodeProps;
  const { open } = useExecutorEditorContext();

  const defaultPorts: NodePort[] = [
    { id: "input", position: Position.Top, type: "target" },
    { id: "yes", position: Position.Right, type: "source", label: "Yes" },
    { id: "no", position: Position.Bottom, type: "source", label: "No" },
  ];
  const ports = data.ports || defaultPorts;

  // Check if execution is configured
  const hasExecutor = !!data.execution?.config?.functionCode;

  // Handle settings button click
  const handleOpenExecutorEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    open(nodeProps as WorkflowNodeProps);
  };

  // 실행 상태에 따른 스타일
  const executionStyles = {
    executing: "scale-125 animate-pulse",
    executed: "scale-115",
    idle: "",
  };

  const executionRingStyles = {
    executing: "ring-4 ring-palette-warning-color",
    executed: "ring-2 ring-palette-warning-color ",
    idle: "",
  };

  return (
    <div className="decision-node relative">
      {/* Diamond Shape Container */}
      <div
        className={`
          relative w-36 h-36
          transition-all duration-200
          ${selected ? "scale-110" : "hover:scale-105"}
          ${data.state?.highlighted ? "scale-110" : ""}
          ${data.state?.dimmed ? "opacity-30" : ""}
          ${executionStyles[data.execution?.state || "idle"]}
        `}
      >
        {/* Diamond Background */}
        <div
          className={`
            absolute inset-0 transform rotate-45
            bg-gradient-to-br from-palette-warning-bg to-palette-warning-border
            rounded-lg shadow-lg
            border-2 transition-all duration-200
            ${
              selected
                ? "border-palette-warning-border shadow-yellow-200 shadow-xl"
                : "border-palette-warning-bg hover:shadow-xl"
            }
            ${data.state?.highlighted ? "border-palette-warning-border shadow-yellow-200 shadow-xl ring-2 ring-yellow-300" : ""}
            ${executionRingStyles[data.execution?.state || "idle"]}
          `}
        />

        {/* Ports */}
        {ports.map((port) => (
          <Port
            key={port.id}
            id={port.id}
            position={port.position}
            type={port.type}
          />
        ))}

        {/* Content - stays upright */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <GitBranch className="w-6 h-6 text-yellow-900" />
              {/* Executor Configuration Button */}
              <button
                onClick={handleOpenExecutorEditor}
                className={`p-0.5 rounded transition ${
                  hasExecutor
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                }`}
                title="Configure evaluator function"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
            <div className="font-semibold text-yellow-900 text-sm max-w-[100px] truncate">
              {data.title}
            </div>
            {data.condition && (
              <div className="text-yellow-800 text-xs mt-1 max-w-[90px] truncate opacity-80">
                {data.condition}
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
