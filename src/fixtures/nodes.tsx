import { Position } from "react-cosmos-diagram";
import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";
import {
  Play,
  ClipboardList,
  GitBranch,
  Globe,
  StopCircle,
} from "lucide-react";

// 통합 노드 템플릿 타입
export type UnifiedNodeTemplate = {
  type: WorkflowNodeType;
  icon: React.ReactNode;
  label: string;
  description: string;
  template: Omit<WorkflowNode, "id" | "position">;
};

// 단일 통합 상수 (Single Source of Truth)
export const UNIFIED_NODE_TEMPLATES: Record<
  WorkflowNodeType,
  UnifiedNodeTemplate
> = {
  start: {
    type: "start",
    icon: <Play className="w-5 h-5 text-green-600" />,
    label: "Start Node",
    description: "Workflow entry point",
    template: {
      type: "start",
      data: {
        title: "Start",
        ports: [{ id: "output", position: Position.Bottom, type: "source" }],
      },
    },
  },
  task: {
    type: "task",
    icon: <ClipboardList className="w-5 h-5 text-blue-600" />,
    label: "Task Node",
    description: "Execute a task",
    template: {
      type: "task",
      data: {
        title: "New Task",
        description: "Add description",
        status: "idle",
        ports: [
          { id: "input", position: Position.Top, type: "target" },
          { id: "output", position: Position.Bottom, type: "source" },
        ],
      },
    },
  },
  decision: {
    type: "decision",
    icon: <GitBranch className="w-5 h-5 text-yellow-600" />,
    label: "Decision Node",
    description: "Conditional branching",
    template: {
      type: "decision",
      data: {
        title: "Decision",
        condition: "Enter condition",
        ports: [
          { id: "input", position: Position.Top, type: "target" },
          { id: "yes", position: Position.Right, type: "source", label: "Yes" },
          { id: "no", position: Position.Bottom, type: "source", label: "No" },
        ],
      },
    },
  },
  service: {
    type: "service",
    icon: <Globe className="w-5 h-5 text-purple-600" />,
    label: "Service Node",
    description: "External API call",
    template: {
      type: "service",
      data: {
        title: "API Call",
        description: "Service description",
        serviceType: "api",
        method: "POST",
        status: "idle",
        ports: [
          { id: "input", position: Position.Top, type: "target" },
          { id: "output", position: Position.Bottom, type: "source" },
        ],
      },
    },
  },
  end: {
    type: "end",
    icon: <StopCircle className="w-5 h-5 text-red-600" />,
    label: "End Node",
    description: "Workflow exit point",
    template: {
      type: "end",
      data: {
        title: "End",
        status: "neutral",
        ports: [{ id: "input", position: Position.Top, type: "target" }],
      },
    },
  },
};
