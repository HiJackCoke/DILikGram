export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "readonly"
  | "keyvalue";

export interface FieldConfig {
  type: FieldType;
  label: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  readonly?: boolean;
}
