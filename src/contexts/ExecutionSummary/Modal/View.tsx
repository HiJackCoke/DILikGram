import {
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  Play,
  Square,
  GitBranch,
  Workflow,
  Folder,
} from "lucide-react";
import type { ExecutionSummary, ExecutionLogEntry } from "@/types/workflow";
import type { WorkflowNodeType } from "@/types/nodes";

interface ExecutionSummaryViewProps {
  summary: ExecutionSummary;
}

// Formatting utilities
function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function formatSuccessRate(successCount: number, totalCount: number): string {
  const percentage = ((successCount / totalCount) * 100).toFixed(0);
  return `${successCount}/${totalCount} (${percentage}%)`;
}

function formatExecutionPath(path: string[]): string {
  return path.join(" → ");
}

// Node type icon mapping
const NODE_TYPE_CONFIG: Record<
  WorkflowNodeType,
  { icon: typeof Play; label: string; color: string }
> = {
  start: { icon: Play, label: "Start", color: "text-green-600 bg-green-50" },
  end: { icon: Square, label: "End", color: "text-gray-600 bg-gray-50" },
  task: { icon: Activity, label: "Task", color: "text-blue-600 bg-blue-50" },
  decision: {
    icon: GitBranch,
    label: "Decision",
    color: "text-yellow-600 bg-yellow-50",
  },
  service: {
    icon: Workflow,
    label: "Service",
    color: "text-purple-600 bg-purple-50",
  },
  group: {
    icon: Folder,
    label: "Group",
    color: "text-yellow-600 bg-yellow-50",
  },
};

// Components
interface StatCardProps {
  icon: typeof Clock;
  label: string;
  value: string;
  iconColor: string;
}

function StatCard({ icon: Icon, label, value, iconColor }: StatCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-xs text-gray-600 font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-800">{value}</div>
    </div>
  );
}

interface NodeCardProps {
  log: ExecutionLogEntry;
  step: number;
}

function NodeCard({ log, step }: NodeCardProps) {
  const config = NODE_TYPE_CONFIG[log.nodeType];
  const Icon = config.icon;
  const isSuccess = log.success;

  return (
    <div
      className={`
        bg-white rounded-lg p-4 border-2 transition-all
        ${isSuccess ? "border-green-200 hover:border-green-300" : "border-red-200 hover:border-red-300"}
        hover:shadow-md
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500">
            Step {step}
          </span>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </div>
        </div>
        {isSuccess ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
      </div>

      {/* Node ID */}
      <div className="mb-2">
        <span className="text-xs text-gray-500">Node ID:</span>
        <code className="ml-2 text-xs font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
          {log.nodeId}
        </code>
      </div>

      {/* Execution Info */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{formatExecutionTime(log.executionTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>{formatTimestamp(log.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ExecutionSummaryView({
  summary,
}: ExecutionSummaryViewProps) {
  const totalNodes = summary.logs.length;
  const successRate = formatSuccessRate(summary.successCount, totalNodes);
  const executionTime = formatExecutionTime(summary.totalExecutionTime);
  const executionPath = formatExecutionPath(summary.executedPath);

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={TrendingUp}
          label="Success Rate"
          value={successRate}
          iconColor="text-green-600"
        />
        <StatCard
          icon={Activity}
          label="Total Nodes"
          value={totalNodes.toString()}
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Execution Time"
          value={executionTime}
          iconColor="text-purple-600"
        />
      </div>

      {/* Execution Path */}
      <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-blue-600" />
          Execution Path
        </h3>
        <div className="text-sm text-gray-700 font-mono break-all">
          {executionPath}
        </div>
      </div>

      {/* Execution Logs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Execution Logs ({totalNodes} nodes)
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {summary.logs.map((log, index) => (
            <NodeCard key={log.nodeId} log={log} step={index + 1} />
          ))}
        </div>
      </div>

      {/* Timestamp Range */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            <span className="font-medium">Started:</span>{" "}
            {formatTimestamp(summary.startTime)}
          </div>
          <div>
            <span className="font-medium">Ended:</span>{" "}
            {formatTimestamp(summary.endTime)}
          </div>
        </div>
      </div>
    </div>
  );
}
