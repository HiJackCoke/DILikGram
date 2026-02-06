import { Port, Position } from "react-cosmos-diagram";
import { Play } from "lucide-react";
import type { StartNodeProps, NodePort } from "@/types/nodes";
import { useWorkflowExecution } from "@/contexts/WorkflowExecution";

export function StartNode({ data, selected, id }: StartNodeProps) {
  const { isExecuting, executingStartNodeId } = useWorkflowExecution();

  const defaultPorts: NodePort[] = [
    { id: "output", position: Position.Bottom, type: "source" },
  ];
  const ports = data.ports || defaultPorts;

  const isThisNodeExecuting = isExecuting && executingStartNodeId === id;

  // 실행 상태에 따른 스타일
  const executionStyles = {
    executing: "ring-4 ring-palette-success-color animate-pulse",
    executed: "ring-2 ring-palette-success-color",
    idle: "",
  };

  return (
    <div
      className={`
        start-node group
        relative w-24 h-24 rounded-3xl
        bg-gradient-to-br from-palette-success-bg to-palette-success-border
        flex items-center justify-center
        shadow-lg transition-all duration-200 cursor-pointer
        ${isThisNodeExecuting ? "scale-110 ring-4 ring-green-400 animate-pulse" : ""}
        ${isExecuting && !isThisNodeExecuting ? "opacity-50 cursor-not-allowed" : ""}
        ${!isExecuting ? "hover:scale-105 hover:shadow-xl active:scale-95" : ""}
        ${
          selected
            ? "ring-4 ring-green-300 shadow-green-200 shadow-xl"
            : "hover:shadow-xl hover:ring-green-300 hover:shadow-green-200"
        }
        ${data.state?.highlighted ? "ring-4 ring-green-400" : ""}
        ${data.state?.dimmed ? "opacity-30" : ""}
        ${executionStyles[data.execution?.state || "idle"]}
      `}
      title={
        isExecuting ? "Execution in progress..." : "Click to execute this flow"
      }
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
        <Play className="w-8 h-8 text-white mx-auto mb-1" fill="white" />
        <span className="text-white font-bold text-sm">
          {data.title || "Start"}
        </span>
      </div>

      {/* Execution indicator */}
      {isThisNodeExecuting && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-ping" />
      )}

      {/* Hover hint */}
      {!isExecuting && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-green-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Click to execute
        </div>
      )}
    </div>
  );
}
