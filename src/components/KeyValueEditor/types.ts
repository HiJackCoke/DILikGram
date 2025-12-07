export interface KeyValuePair {
  key: string;
  value: string;
}

export interface KeyValueEditorProps {
  label: string;
  value: Record<string, string>;
  disabled?: boolean;
  placeholder?: { key?: string; value?: string };
  onChange: (value: Record<string, string>) => void;
}

export interface KeyValueEditorViewProps {
  label: string;
  pairs: KeyValuePair[];
  disabled: boolean;
  placeholder: { key?: string; value?: string };
  onAdd: () => void;
  onEdit: (oldKey: string, newKey: string, newValue: string) => void;
  onRemove: (key: string) => void;
}
