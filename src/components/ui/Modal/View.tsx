import { X } from "lucide-react";
import type { ModalViewProps } from "@/types/modal";

export default function ModalView({
  title = "",
  description = "",
  children,
  onClose,
  onConfirm,
}: ModalViewProps) {
  return (
    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {title}
          </h2>
          <div className="text-sm text-gray-500 mt-1">{description}</div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}

      {onClose && onConfirm && (
        <div className="flex items-center justify-end gap-3  px-6 py-4 border-t">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition flex items-center gap-2"
            >
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition"
            >
              Confirm
            </button>
          )}
        </div>
      )}
    </div>
  );
}
