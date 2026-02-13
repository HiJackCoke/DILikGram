import { Plus, Trash2 } from "lucide-react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { KeyValueEditorViewProps } from "./types";
import { parseKey } from "./utils";

export default function KeyValueEditorView({
  label,
  pairs,
  disabled = false,
  placeholder = { key: "Key", value: "Value" },
  keySchema = {},
  editable = true,
  onAdd,
  onEdit,
  onRemove,
}: KeyValueEditorViewProps) {
  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-sm font-medium text-slate-200">
        {label}
      </label>

      {/* Key-Value Pairs */}
      <div className="space-y-2">
        {pairs.map((pair) => {
          const config = keySchema["*"] || keySchema[pair.key] || {};
          const isKeyReadonly = config.readOnly ?? false;
          const valueType = config.valueType ?? "text";
          const keyType = config.keyType ?? "text";

          return (
            <div key={pair.key} className="flex gap-2">
              {/* Key Input/Select */}
              <div className="flex-1">
                {keyType === "select" ? (
                  <Select
                    label=""
                    value={parseKey(pair.key).baseKey}
                    onChange={(newKey) => {
                      if (newKey) onEdit(pair.key, newKey, pair.value);
                    }}
                    options={config.keyOptions || []}
                    disabled={disabled || isKeyReadonly}
                    searchable={false}
                  />
                ) : (
                  <Input
                    label=""
                    value={pair.key}
                    onChange={(newKey) =>
                      onEdit(pair.key, newKey as string, pair.value)
                    }
                    placeholder={placeholder.key || "Key"}
                    disabled={disabled || isKeyReadonly}
                  />
                )}
              </div>

              {/* Value Input */}
              <div className="flex-1">
                {valueType === "number" ? (
                  <Input
                    type="number"
                    formatNumber
                    value={Number(pair.value)}
                    placeholder={placeholder.value || "Value"}
                    disabled={disabled}
                    onChange={(newValue) => {
                      onEdit(pair.key, parseKey(pair.key).baseKey, newValue);
                    }}
                  />
                ) : valueType === "select" ? (
                  <Select
                    label=""
                    value={String(pair.value)}
                    onChange={(newValue) => {
                      if (newValue)
                        onEdit(pair.key, parseKey(pair.key).baseKey, newValue);
                    }}
                    options={config.options || []}
                    disabled={disabled}
                    searchable={false}
                  />
                ) : (
                  <Input
                    value={String(pair.value)}
                    placeholder={placeholder.value || "Value"}
                    disabled={disabled}
                    onChange={(newValue) => {
                      onEdit(pair.key, parseKey(pair.key).baseKey, newValue);
                    }}
                  />
                )}
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => onRemove(pair.key)}
                disabled={disabled || isKeyReadonly || !editable}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Remove pair"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {/* Empty State */}
        {pairs.length === 0 && (
          <div className="text-sm text-slate-400 py-3 text-center border border-dashed border-slate-600 rounded-lg">
            No metadata entries. Click "Add Entry" to create one.
          </div>
        )}
      </div>

      {/* Add Button */}
      {!disabled && editable && (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || !editable}
          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      )}
    </div>
  );
}
