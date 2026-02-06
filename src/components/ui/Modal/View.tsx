import { X } from "lucide-react";
import type { ModalViewProps } from "@/types/modal";

export default function ModalView({
  title = "",
  description = "",
  children,
  onClose,
}: ModalViewProps) {
  return (
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  );
}
