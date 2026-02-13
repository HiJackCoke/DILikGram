import KeyValueEditorView from "./View";
import type { KeyValueEditorProps, KeyValuePair } from "./types";
import { parseKey, generateKeyWithId } from "./utils";

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
    const globalConfig = keySchema["*"];

    let newKey: string;
    if (globalConfig?.keyType === "select" && globalConfig.keyOptions) {
      // Use first option and add unique ID
      const baseKey = globalConfig.keyOptions[0]?.value || "key";
      newKey = generateKeyWithId(baseKey);
    } else {
      // Generate unique key (no ID for text type)
      newKey = `key${Object.keys(value).length + 1}`;
    }

    onChange({ ...value, [newKey]: "" });
  };

  const handleEdit = (
    oldKey: string,
    newKey: string,
    newValue: string | number
  ) => {
    const globalConfig = keySchema["*"];

    let finalKey: string;
    if (globalConfig?.keyType === "select") {
      // If key changed, generate new key with ID
      const oldParsed = parseKey(oldKey);
      if (oldParsed.baseKey !== newKey) {
        finalKey = generateKeyWithId(newKey);
      } else {
        // Key not changed, keep old key
        finalKey = oldKey;
      }
    } else {
      // Text type: use newKey directly
      finalKey = newKey;
    }

    // Preserve order by rebuilding object with same key order
    const updated: Record<string, string | number> = {};

    Object.entries(value || {}).forEach(([k, v]) => {
      if (k === oldKey) {
        // Replace this entry with the new key-value
        updated[finalKey] = newValue;
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
