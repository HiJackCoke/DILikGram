import type { KeySchema } from "@/components/KeyValueEditor/types";
import type { WorkflowNode } from "./nodes";
import type { DeepKeysOfUnion } from "./utils";

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  // | "readOnly"
  | "keyvalue"
  | "tab"
  | "port";

type TabItemOptions = FieldConfig & {
  key: DeepKeysOfUnion<WorkflowNode["data"]>;
};
export interface TabOption {
  label: string;
  value: string;
  options?: TabItemOptions[];
}

export interface FieldConfig {
  type: FieldType;
  label: string;
  key?: string;
  options?: TabOption[];
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  editable?: boolean;
  keySchema?: Record<string, KeySchema>;
}
