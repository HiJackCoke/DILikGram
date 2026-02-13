import Input from "@/components/ui/Input";
import { Plus, Trash2 } from "lucide-react";
import type { PortEditorViewProps, PortItem } from "./types";

interface PortRowProps
  extends Pick<PortEditorViewProps, "onEditLabel" | "onRemove" | "readOnly"> {
  port: PortItem;
}

function PortRow({ port, readOnly, onEditLabel, onRemove }: PortRowProps) {
  return (
    <div className="flex gap-2">
      {/* Label Input */}
      <div className="flex-1">
        <Input
          label=""
          value={port.label || (port.type === "target" ? "Input" : "Output")}
          onChange={(newLabel) => onEditLabel(port.id, newLabel as string)}
          placeholder="Port label"
          readOnly
        />
      </div>

      {/* Connected Node ID (read-only) */}
      <div className="flex-1">
        <Input
          label=""
          value={port.connectedNodeId || ""}
          placeholder="Not connected"
          readOnly={readOnly}
        />
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={() => onRemove(port.id)}
        disabled={readOnly}
        className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Remove port"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function PortEditorView({
  label,
  targetPorts,
  sourcePorts,
  limits,
  readOnly = false,
  canAddTarget,
  canAddSource,
  validationError,
  onAddTarget,
  onAddSource,
  onEditLabel,
  onRemove,
}: PortEditorViewProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-200">
        {label}
      </label>

      {/* Target Ports Section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">
            Target Ports (max {limits.maxTarget})
          </span>
        </div>

        {targetPorts.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex gap-2 px-2">
              <div className="flex-1 text-xs text-slate-500">Label</div>
              <div className="flex-1 text-xs text-slate-500">Connected To</div>
              <div className="w-10"></div>
            </div>

            {targetPorts.map((port) => (
              <PortRow
                key={port.id}
                port={port}
                readOnly={readOnly}
                onEditLabel={onEditLabel}
                onRemove={onRemove}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 py-2 text-center border border-dashed border-slate-600 rounded-lg">
            No target ports
          </div>
        )}

        {!readOnly && canAddTarget && (
          <button
            type="button"
            onClick={onAddTarget}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Target Port
          </button>
        )}
      </div>

      {/* Source Ports Section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">
            Source Ports (max {limits.maxSource})
          </span>
        </div>

        {sourcePorts.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex gap-2 px-2">
              <div className="flex-1 text-xs text-slate-500">Label</div>
              <div className="flex-1 text-xs text-slate-500">Connected To</div>
              <div className="w-10"></div>
            </div>

            {sourcePorts.map((port) => (
              <PortRow
                key={port.id}
                port={port}
                readOnly={readOnly}
                onEditLabel={onEditLabel}
                onRemove={onRemove}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 py-2 text-center border border-dashed border-slate-600 rounded-lg">
            No source ports
          </div>
        )}

        {!readOnly && canAddSource && (
          <button
            type="button"
            onClick={onAddSource}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Source Port
          </button>
        )}
      </div>

      {/* Validation Errors */}
      {validationError && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-400/30 rounded-lg px-3 py-2">
          {validationError}
        </div>
      )}
    </div>
  );
}
