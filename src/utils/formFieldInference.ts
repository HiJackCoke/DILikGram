export type FieldType = "text" | "textarea" | "select" | "number" | "readonly";

export interface FieldConfig {
  type: FieldType;
  label: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  readonly?: boolean;
}

// 필드 타입 추론 로직
export function inferFieldType(key: string, value: unknown): FieldConfig {
  // Special cases (읽기 전용 필드)
  if (
    key === "icon" ||
    key === "ports" ||
    key === "state" ||
    key === "status" ||
    key === "executor"
  ) {
    return { type: "readonly", label: key, readonly: true };
  }

  // String enum fields (select)
  if (key === "status" && typeof value === "string") {
    return {
      type: "select",
      label: "Status",
      options: [
        { label: "Idle", value: "idle" },
        { label: "Running", value: "running" },
        { label: "Completed", value: "completed" },
        { label: "Error", value: "error" },
      ],
    };
  }

  if (key === "serviceType") {
    return {
      type: "select",
      label: "Service Type",
      options: [
        { label: "API", value: "api" },
        { label: "Database", value: "database" },
        { label: "Email", value: "email" },
        { label: "Webhook", value: "webhook" },
        { label: "Custom", value: "custom" },
      ],
    };
  }

  if (key === "method") {
    return {
      type: "select",
      label: "HTTP Method",
      options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" },
        { label: "DELETE", value: "DELETE" },
      ],
    };
  }

  // Number fields
  if (typeof value === "number" || key === "estimatedTime") {
    return {
      type: "number",
      label: formatLabel(key),
      placeholder: `Enter ${formatLabel(key).toLowerCase()}`,
    };
  }

  // Long text fields (textarea)
  if (key === "description" || key === "condition") {
    return {
      type: "textarea",
      label: formatLabel(key),
      placeholder: `Enter ${formatLabel(key).toLowerCase()}`,
    };
  }

  // Default: text field
  return {
    type: "text",
    label: formatLabel(key),
    placeholder: `Enter ${formatLabel(key).toLowerCase()}`,
  };
}

// Helper: format key to readable label
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1") // camelCase to spaces
    .replace(/^./, (str) => str.toUpperCase()); // capitalize first letter
}
