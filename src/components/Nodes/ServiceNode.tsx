import { Port, Position } from "react-cosmos-diagram";
import {
  Circle,
  Loader2,
  CheckCircle,
  AlertCircle,
  Globe,
  Database,
  Mail,
  Webhook,
  Settings,
} from "lucide-react";
import type {
  ServiceNodeProps,
  NodeStatus,
  NodePort,
  ServiceType,
  HttpMethod,
  WorkflowNodeProps,
} from "@/types/nodes";
import { useExecutorEditorContext } from "@/contexts/ExecutorEditor";

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
    color: "text-palette-secondary-bg",
    bg: "bg-purple-50",
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

const serviceIcons: Record<ServiceType, typeof Globe> = {
  api: Globe,
  database: Database,
  email: Mail,
  webhook: Webhook,
  custom: Settings,
};

const methodColors: Record<HttpMethod, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-yellow-100 text-yellow-700",
  DELETE: "bg-red-100 text-red-700",
};

export function ServiceNode(nodeProps: ServiceNodeProps) {
  const { data, selected } = nodeProps;
  const { open } = useExecutorEditorContext();

  const status = data.status || "idle";
  const StatusIcon = statusConfig[status]?.icon || Circle;
  const ServiceIcon = serviceIcons[data.serviceType || "api"];

  const defaultPorts: NodePort[] = [
    { id: "input", position: Position.Top, type: "target" },
    { id: "output", position: Position.Bottom, type: "source" },
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
    executing: "ring-4 ring-palette-secondary-color animate-pulse scale-105",
    executed: "ring-2 ring-palette-secondary-color",
    error:
      "ring-4 ring-palette-danger-color border-palette-danger-bg shadow-red-200",
    idle: "",
  };

  return (
    <div className="service-node">
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
        relative w-[200px] max-w-[280px] min-h-[120px] bg-white rounded-xl shadow-lg 
        border-2 transition-all duration-200
        overflow-hidden
        ${
          selected
            ? "border-palette-secondary-bg shadow-purple-200 shadow-xl"
            : "border-gray-200 hover:shadow-xl hover:border-palette-secondary-bg hover:shadow-purple-200"
        }
        ${data.state?.highlighted ? "border-palette-secondary-bg shadow-purple-200 shadow-xl ring-2 ring-purple-300" : ""}
        ${data.state?.dimmed ? "opacity-30" : ""}
        ${data.execution?.error ? executionStyles.error : executionStyles[data.execution?.state || "idle"]}
      `}
      >
        {/* Ports */}

        {/* Header */}
        <div className="bg-gradient-to-r from-palette-secondary-bg to-palette-secondary-border px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-white">
              {data.icon || <ServiceIcon className="w-4 h-4" />}
            </span>
            <span className="text-white font-semibold text-sm truncate flex-1">
              {data.title}
            </span>
            {/* Executor Configuration Button */}
            <button
              disabled={data.mode === "panel"}
              onClick={handleOpenExecutorEditor}
              className={`p-1 rounded transition ${
                hasExecutor && data.mode === "code"
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

          {/* Service Info */}
          <div className="space-y-2">
            {data.http?.method && (
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${methodColors[data.http.method]}`}
                >
                  {data.http.method}
                </span>
                <span className="text-xs text-gray-400 capitalize">
                  {data.serviceType || "api"}
                </span>
              </div>
            )}

            {data.http?.endpoint && (
              <div className="text-xs text-gray-600 font-mono bg-gray-50 px-3 py-1.5 rounded-lg truncate">
                {data.http.endpoint}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
