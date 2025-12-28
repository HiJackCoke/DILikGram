import { CheckCircle, AlertCircle, X } from "lucide-react";
import type {
  ToastViewProps,
  ToastMessageProps,
} from "@/components/Toast/type";

import "@/styles/toast.css";

const COLOR_PROPS = {
  success: {
    bg: "bg-palette-success-bg",
    border: "border-palette-success-bg",
  },
  alert: {
    bg: "bg-palette-danger-bg",
    border: "border-palette-danger-bg",
  },
};

function ToastMessage({
  toast,
  duration,
  onClose,
  onClick,
}: ToastMessageProps) {
  const colors = COLOR_PROPS[toast.type];

  return (
    <div
      role="alert"
      className={`
        relative flex items-center gap-2.5
        w-[22rem] max-w-[70vw] h-14
        px-2 py-2 rounded-lg
        ${colors.bg} ${colors.border} border
        text-white
        toast-message
        z-10
        cursor-pointer
        hover:opacity-75
      `}
      style={
        {
          "--animation-duration": `${duration}ms`,
        } as React.CSSProperties
      }
      onClick={onClick}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {toast.type === "success" ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
      </div>

      {/* Message */}
      <span className="flex-1 text-sm font-normal">{toast.message}</span>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-2 p-0 bg-transparent border-none cursor-pointer text-white hover:opacity-80 transition-opacity"
        aria-label="Close toast"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

const ToastView = ({
  toasts,
  duration,
  closeMessage,
  onClick,
}: ToastViewProps) => {
  return (
    <>
      <div className="fixed top-4 right-4 grid gap-4 z-[9999]">
        {toasts.map((toast) => (
          <ToastMessage
            key={toast.id}
            toast={toast}
            duration={duration}
            onClose={() => closeMessage(toast.id)}
            onClick={() => onClick?.()}
          />
        ))}
      </div>
    </>
  );
};

export default ToastView;
