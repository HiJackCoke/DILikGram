import { Port } from "react-cosmos-diagram";
import {
  Circle,
  Loader2,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  Settings,
} from "lucide-react";
import type {
  TaskNodeProps,
  NodeStatus,
  WorkflowNodeProps,
} from "@/types/nodes";
import { useExecutorEditor } from "@/contexts/ExecutorEditor";
import { getDefaultPorts } from "@/utils/graph/nodes";

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
    color: "text-palette-primary-bg",
    bg: "bg-blue-50",
    animate: "animate-spin",
  },
  completed: {
    icon: CheckCircle,
    color: "text-palette-success-bg",
    bg: "bg-green-50",
  },
  error: {
    icon: AlertCircle,
    color: "text-palette-danger-bg",
    bg: "bg-red-50",
  },
};

export function TaskNode(nodeProps: TaskNodeProps) {
  const { data, selected } = nodeProps;
  const { open } = useExecutorEditor();

  const status = data.status || "idle";
  const StatusIcon = statusConfig[status]?.icon || Circle;

  const ports = data.ports || getDefaultPorts("task");

  // Check if execution is configured
  const hasExecutor = !!data.execution?.config?.functionCode;

  // Handle settings button click
  const handleOpenExecutorEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    open(nodeProps as WorkflowNodeProps);
  };

  // 실행 상태에 따른 스타일
  const executionStyles = {
    executing: "ring-4 ring-palette-primary-color animate-pulse scale-105",
    executed: "ring-2 ring-palette-primary-color",
    error:
      "ring-4 ring-palette-danger-color border-palette-danger-bg shadow-red-200",
    idle: "",
  };

  return (
    <div className="task-node relative">
      {/* Ports */}
      {ports.map((port) => (
        <Port
          key={port.id}
          id={port.id}
          position={port.position}
          type={port.type}
        />
      ))}
      <div
        className={`
        relative min-w-[200px] max-w-[240px] min-h-[120px] bg-white rounded-xl shadow-lg 
        border-2 transition-all duration-200
        overflow-hidden
        ${
          selected
            ? "border-palette-primary-bg shadow-blue-200 shadow-xl"
            : "border-gray-200 hover:shadow-xl hover:border-palette-primary-bg hover:shadow-blue-200 shadow-xl"
        }
        ${data.state?.highlighted ? "border-palette-primary-bg shadow-blue-200 shadow-xl ring-2 ring-blue-300" : ""}
        ${data.state?.dimmed ? "opacity-30" : ""}
        ${data.execution?.error ? executionStyles.error : executionStyles[data.execution?.state || "idle"]}
      `}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-palette-primary-bg to-palette-primary-border px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-white">
              {data.icon || <ClipboardList className="w-4 h-4" />}
            </span>
            <span className="text-white font-semibold text-sm truncate flex-1">
              {data.title}
            </span>
            {/* Executor Configuration Button */}
            <button
              onClick={handleOpenExecutorEditor}
              className={`p-1 rounded transition ${
                hasExecutor
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
              title="Configure execution function"
            >
              <Settings className="w-3 h-3" />
            </button>
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
          {(!!data.assignee || !!data.estimatedTime) && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {!!data.assignee && (
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  👤 {data.assignee}
                </span>
              )}
              {!!data.estimatedTime && (
                <span className="px-2 py-1 bg-blue-50 text-palette-primary-bg rounded-full text-xs">
                  ⏱ {data.estimatedTime}분
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
