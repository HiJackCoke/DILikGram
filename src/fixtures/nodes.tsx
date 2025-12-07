import { Position } from "react-cosmos-diagram";
import type { WorkflowNode, WorkflowNodeType } from "@/types/nodes";

import {
  Play,
  ClipboardList,
  GitBranch,
  Globe,
  StopCircle,
} from "lucide-react";
import type { FieldConfig } from "@/types/editor";

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
        assignee: "",
        estimatedTime: 0,
        metadata: {},
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
        endpoint: "",
        timeout: 5000,
        retry: {
          count: 3,
          delay: 1000,
        },
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

// ============================================================================
// Field Definitions for Each Node Type
// ============================================================================

// Start Node Fields
const START_NODE_FIELDS: Record<string, FieldConfig> = {
  title: {
    type: "text",
    label: "Title",
    placeholder: "Enter title",
  },
  ports: {
    type: "readonly",
    label: "Ports",
    readonly: true,
  },
  state: {
    type: "readonly",
    label: "State",
    readonly: true,
  },
};

// Task Node Fields
const TASK_NODE_FIELDS: Record<string, FieldConfig> = {
  title: {
    type: "text",
    label: "Title",
    placeholder: "Enter task title",
  },
  description: {
    type: "textarea",
    label: "Description",
    placeholder: "Enter task description",
  },
  status: {
    type: "select",
    label: "Status",
    options: [
      { label: "Idle", value: "idle" },
      { label: "Running", value: "running" },
      { label: "Completed", value: "completed" },
      { label: "Error", value: "error" },
    ],
  },
  assignee: {
    type: "text",
    label: "Assignee",
    placeholder: "Enter assignee name",
  },
  estimatedTime: {
    type: "number",
    label: "Estimated Time (min)",
    placeholder: "Enter estimated time",
  },
  metadata: {
    type: "keyvalue",
    label: "Metadata",
  },
  icon: {
    type: "readonly",
    label: "Icon",
    readonly: true,
  },
  ports: {
    type: "readonly",
    label: "Ports",
    readonly: true,
  },
};

// Decision Node Fields
const DECISION_NODE_FIELDS: Record<string, FieldConfig> = {
  title: {
    type: "text",
    label: "Title",
    placeholder: "Enter decision title",
  },
  condition: {
    type: "textarea",
    label: "Condition",
    placeholder: "Enter decision condition",
  },
  ports: {
    type: "readonly",
    label: "Ports",
    readonly: true,
  },
};

// Service Node Fields
const SERVICE_NODE_FIELDS: Record<string, FieldConfig> = {
  title: {
    type: "text",
    label: "Title",
    placeholder: "Enter service title",
  },
  description: {
    type: "textarea",
    label: "Description",
    placeholder: "Enter service description",
  },
  serviceType: {
    type: "select",
    label: "Service Type",
    options: [
      { label: "API", value: "api" },
      { label: "Database", value: "database" },
      { label: "Email", value: "email" },
      { label: "Webhook", value: "webhook" },
      { label: "Custom", value: "custom" },
    ],
  },
  method: {
    type: "select",
    label: "HTTP Method",
    options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
      { label: "PUT", value: "PUT" },
      { label: "DELETE", value: "DELETE" },
    ],
  },
  endpoint: {
    type: "text",
    label: "Endpoint",
    placeholder: "Enter API endpoint",
  },
  timeout: {
    type: "number",
    label: "Timeout (ms)",
    placeholder: "Enter timeout in milliseconds",
  },
  retry: {
    type: "keyvalue",
    label: "Retry",
    keySchema: {
      count: {
        valueType: "number",
        readonly: true,
      },
      delay: {
        valueType: "number",
        readonly: true,
      },
    },
  },
  status: {
    type: "select",
    label: "Status",
    options: [
      { label: "Idle", value: "idle" },
      { label: "Running", value: "running" },
      { label: "Completed", value: "completed" },
      { label: "Error", value: "error" },
    ],
  },
  icon: {
    type: "readonly",
    label: "Icon",
    readonly: true,
  },
  ports: {
    type: "readonly",
    label: "Ports",
    readonly: true,
  },
};

// End Node Fields
const END_NODE_FIELDS: Record<string, FieldConfig> = {
  title: {
    type: "text",
    label: "Title",
    placeholder: "Enter title",
  },
  status: {
    type: "select",
    label: "Status",
    options: [
      { label: "Success", value: "success" },
      { label: "Failure", value: "failure" },
      { label: "Neutral", value: "neutral" },
    ],
  },
  ports: {
    type: "readonly",
    label: "Ports",
    readonly: true,
  },
};

// Export consolidated field definitions
export const NODE_FIELD_DEFINITIONS: Record<
  WorkflowNodeType,
  Record<string, FieldConfig>
> = {
  start: START_NODE_FIELDS,
  task: TASK_NODE_FIELDS,
  decision: DECISION_NODE_FIELDS,
  service: SERVICE_NODE_FIELDS,
  end: END_NODE_FIELDS,
};
