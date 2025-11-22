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
} from "@/types/nodes";

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
    color: "text-purple-500",
    bg: "bg-purple-50",
    animate: "animate-spin",
  },
  completed: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
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

export function ServiceNode({ data, selected }: ServiceNodeProps) {
  const status = data.status || "idle";
  const StatusIcon = statusConfig[status]?.icon || Circle;
  const ServiceIcon = serviceIcons[data.serviceType || "api"];

  const defaultPorts: NodePort[] = [
    { id: "input", position: Position.Top, type: "target" },
    { id: "output", position: Position.Bottom, type: "source" },
  ];
  const ports = data.ports || defaultPorts;

  return (
    <div
      className={`
        service-node
        relative min-w-[200px] max-w-[280px] bg-white rounded-xl shadow-lg 
        border-2 transition-all duration-200
        overflow-hidden
        ${
          selected
            ? "border-purple-500 shadow-purple-200 shadow-xl scale-105"
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
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-white">
            {data.icon || <ServiceIcon className="w-4 h-4" />}
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

        {/* Service Info */}
        <div className="space-y-2">
          {data.method && (
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${methodColors[data.method]}`}
              >
                {data.method}
              </span>
              <span className="text-xs text-gray-400 capitalize">
                {data.serviceType || "api"}
              </span>
            </div>
          )}

          {data.endpoint && (
            <div className="text-xs text-gray-600 font-mono bg-gray-50 px-3 py-1.5 rounded-lg truncate">
              {data.endpoint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
