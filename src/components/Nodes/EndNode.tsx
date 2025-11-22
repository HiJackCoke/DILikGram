import { Port, Position } from "react-cosmos-diagram";
import { Square, CheckCircle, XCircle } from "lucide-react";
import type { EndNodeProps, EndNodeStatus, NodePort } from "@/types/nodes";

const statusStyles: Record<
  EndNodeStatus,
  {
    gradient: string;
    ring: string;
    shadow: string;
    Icon: typeof Square;
  }
> = {
  success: {
    gradient: "from-green-500 to-emerald-600",
    ring: "ring-green-300",
    shadow: "shadow-green-200",
    Icon: CheckCircle,
  },
  failure: {
    gradient: "from-red-500 to-rose-600",
    ring: "ring-red-300",
    shadow: "shadow-red-200",
    Icon: XCircle,
  },
  neutral: {
    gradient: "from-gray-500 to-slate-600",
    ring: "ring-gray-300",
    shadow: "shadow-gray-200",
    Icon: Square,
  },
};

export function EndNode({ data, selected }: EndNodeProps) {
  const status = data.status || "neutral";
  const { gradient, ring, shadow, Icon } = statusStyles[status];

  const defaultPorts: NodePort[] = [
    { id: "input", position: Position.Top, type: "target" },
  ];
  const ports = data.ports || defaultPorts;

  return (
    <div
      className={`
        end-node
        relative w-24 h-24 rounded-full 
        bg-gradient-to-br ${gradient}
        flex items-center justify-center 
        shadow-lg transition-all duration-200 cursor-pointer
        ${
          selected
            ? `ring-4 ${ring} scale-110 ${shadow} shadow-xl`
            : "hover:scale-105 hover:shadow-xl"
        }
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
  );
}
