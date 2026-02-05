/**
 * UndoRedoButtons - Undo/Redo controls for workflow versioning
 */

import { Undo2, Redo2 } from "lucide-react";
import { useWorkflowVersioning } from "@/contexts/WorkflowVersioning";

export default function UndoRedoButtons() {
  const { canUndo, canRedo, undo, redo } = useWorkflowVersioning();

  return (
    <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-lg p-1">
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="p-2 rounded text-white hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-slate-700" />
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className="p-2 rounded text-white hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Redo2 className="w-4 h-4" />
      </button>
    </div>
  );
}
