import KeyValueEditorView from "./View";
import type { KeyValueEditorProps, KeyValuePair } from "./types";

export default function KeyValueEditor({
  label,
  value,
  disabled,
  editable,
  placeholder,
  keySchema = {},
  onChange,
}: KeyValueEditorProps) {
  // Convert Record<string, string> to KeyValuePair[]
  const pairs: KeyValuePair[] = Object.entries(value || {}).map(
    ([key, val]) => ({
      key,
      value: val,
    })
  );

  const handleAdd = () => {
    // Generate unique key
    const newKey = `key${pairs.length + 1}`;
    onChange({ ...value, [newKey]: "" });
  };

  const handleEdit = (
    oldKey: string,
    newKey: string,
    newValue: string | number
  ) => {
    // Preserve order by rebuilding object with same key order
    const updated: Record<string, string | number> = {};

    Object.entries(value || {}).forEach(([k, v]) => {
      if (k === oldKey) {
        // Replace this entry with the new key-value
        updated[newKey] = newValue;
      } else {
        // Keep existing entry
        updated[k] = v;
      }
    });

    onChange(updated);
  };

  const handleRemove = (key: string) => {
    const updated = { ...value };
    delete updated[key];
    onChange(updated);
  };

  return (
    <KeyValueEditorView
      label={label}
      pairs={pairs}
      disabled={disabled}
      editable={editable}
      placeholder={placeholder}
      keySchema={keySchema}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onRemove={handleRemove}
    />
  );
}
