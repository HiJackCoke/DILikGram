import { Port, Position } from "react-cosmos-diagram";
import {
  Circle,
  Loader2,
  CheckCircle,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import type { TaskNodeProps, NodeStatus, NodePort } from "@/types/nodes";

const statusConfig: Record<
  NodeStatus,
  {
    icon: typeof Circle;
    color: string;
    bg: string;
    animate?: string;
  }
> = {
  idle: { icon: Circle, color: "text-gray-400", bg: "bg-gray-100" },
  running: {
    icon: Loader2,
    color: "text-blue-500",
    bg: "bg-blue-50",
    animate: "animate-spin",
  },
  completed: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
};

export function TaskNode({ data, selected }: TaskNodeProps) {
  const status = data.status || "idle";
  const StatusIcon = statusConfig[status]?.icon || Circle;

  const defaultPorts: NodePort[] = [
    { id: "input", position: Position.Top, type: "target" },
    { id: "output", position: Position.Bottom, type: "source" },
  ];
  const ports = data.ports || defaultPorts;

  return (
    <div
      className={`
        task-node
        relative min-w-[200px] max-w-[280px] bg-white rounded-xl shadow-lg 
        border-2 transition-all duration-200
        overflow-hidden
        ${
          selected
            ? "border-blue-500 shadow-blue-200 shadow-xl scale-105"
            : "border-gray-200 hover:border-gray-300 hover:shadow-xl"
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

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 ">
        <div className="flex items-center gap-2">
          <span className="text-white">
            {data.icon || <ClipboardList className="w-4 h-4" />}
          </span>
          <span className="text-white font-semibold text-sm truncate flex-1">
            {data.title}
          </span>
          <div className={`p-1 rounded-full ${statusConfig[status]?.bg}`}>
            <StatusIcon
              className={`w-3 h-3 ${statusConfig[status]?.color} ${statusConfig[status]?.animate || ""}`}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {data.description && (
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            {data.description}
          </p>
        )}

        {/* Metadata */}
        {data.metadata && Object.keys(data.metadata).length > 0 && (
          <div className="space-y-2 mb-3">
            {Object.entries(data.metadata).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-500">{key}</span>
                <span className="text-gray-700 font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Assignee & Estimated Time */}
        {(data.assignee || data.estimatedTime) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {data.assignee && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                👤 {data.assignee}
              </span>
            )}
            {data.estimatedTime && (
              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs">
                ⏱ {data.estimatedTime}분
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
