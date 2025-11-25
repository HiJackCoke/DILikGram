import { Port, Position } from "react-cosmos-diagram";
import { Play } from "lucide-react";
import type { StartNodeProps, NodePort } from "@/types/nodes";

export function StartNode({ data, selected }: StartNodeProps) {
  const defaultPorts: NodePort[] = [
    { id: "output", position: Position.Bottom, type: "source" },
  ];
  const ports = data.ports || defaultPorts;

  // 실행 상태에 따른 스타일
  const executionStyles = {
    executing: "ring-4 ring-palette-success-color animate-pulse",
    executed: "ring-2 ring-palette-success-color",
    idle: "",
  };

  return (
    <div
      className={`
        start-node
        relative w-24 h-24 rounded-full 
        bg-gradient-to-br from-palette-success-bg to-palette-success-border
        flex items-center justify-center 
        shadow-lg transition-all duration-200 cursor-pointer
        ${
          selected
            ? "ring-4 ring-green-300 scale-110 shadow-green-200 shadow-xl"
            : "hover:scale-105 hover:shadow-xl"
        }
        ${data.highlighted ? "ring-4 ring-green-400 scale-110" : ""}
        ${data.dimmed ? "opacity-30" : ""}
        ${executionStyles[data.executionState || "idle"]}
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
        <Play className="w-8 h-8 text-white mx-auto mb-1" fill="white" />
        <span className="text-white font-bold text-sm">
          {data.title || "Start"}
        </span>
      </div>
    </div>
  );
}
