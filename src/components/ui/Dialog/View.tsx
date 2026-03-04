import type { ReactNode } from "react";
import type { DialogType } from "./type";
import Button from "@/components/ui/Button";

interface DialogViewProps {
  title: string;
  description: ReactNode;
  type: DialogType;
  revealed: boolean;

  onConfirm: () => void;
  onCancel: () => void;
}

export default function DialogView({
  title,
  description,
  type,
  revealed,
  onConfirm,
  onCancel,
}: DialogViewProps) {
  if (!revealed) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center animate-in fade-in duration-200"
        onClick={type === "alert" ? undefined : onCancel}
      >
        {/* Dialog Section */}
        <div
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {title}
          </h2>

          {/* Description */}
          {description && (
            <div className="text-gray-600 dark:text-gray-300 mb-6">
              {typeof description === "string" ? (
                <p>{description}</p>
              ) : (
                description
              )}
            </div>
          )}

          {/* Button Container */}
          <div className="flex gap-3 justify-end">
            {type !== "alert" && (
              <Button palette="danger" onClick={onCancel}>
                취소
              </Button>
            )}
            <Button palette="primary" onClick={onConfirm}>
              확인
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
