export interface KeyValuePair {
  key: string;
  value: string | number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface KeySchema {
  valueType?: "text" | "number" | "select";
  readOnly?: boolean;
  options?: SelectOption[];
  keyType?: "text" | "select";
  keyOptions?: SelectOption[];
}
interface BaseKeyValueEditorProps {
  label: string;
  disabled?: boolean;
  placeholder?: { key?: string; value?: string };
  keySchema?: Record<string, KeySchema>;
  editable?: boolean;
}

export interface KeyValueEditorProps extends BaseKeyValueEditorProps {
  value: Record<string, string | number>;
  onChange: (value: Record<string, string | number>) => void;
}

export interface KeyValueEditorViewProps extends BaseKeyValueEditorProps {
  pairs: KeyValuePair[];
  onAdd: () => void;
  onEdit: (oldKey: string, newKey: string, newValue: string | number) => void;
  onRemove: (key: string) => void;
}
