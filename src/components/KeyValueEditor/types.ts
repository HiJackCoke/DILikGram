export interface KeyValuePair {
  key: string;
  value: string | number;
}

interface KeySchema {
  valueType?: "text" | "number";
  readonly?: boolean;
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
