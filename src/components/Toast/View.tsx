import { CheckCircle, AlertCircle, X } from "lucide-react";
import type { ToastViewProps, ToastProps } from "@/components/Toast/type";

import "@/styles/toast.css";

interface ToastMessageProps {
  toast: ToastProps;
  duration: number;
  onClose: () => void;
}

function ToastMessage({ toast, duration, onClose }: ToastMessageProps) {
  const bgColor =
    toast.type === "alert" ? "bg-palette-danger-bg" : "bg-palette-success-bg";

  const borderColor =
    toast.type === "alert"
      ? "border-palette-danger-border"
      : "border-palette-success-border";

  return (
    <div
      role="alert"
      className={`
        relative flex items-center gap-2.5
        w-[22rem] max-w-[70vw] h-14
        px-2 py-2 rounded-lg
        ${bgColor} ${borderColor} border
        text-white
        toast-message
        z-10
      `}
      style={
        {
          "--animation-duration": `${duration}ms`,
        } as React.CSSProperties
      }
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

const ToastView = ({ toasts, duration, closeMessage }: ToastViewProps) => {
  return (
    <>
      <div className="fixed top-4 right-4 grid gap-4 z-[9999]">
        {toasts.map((toast) => (
          <ToastMessage
            key={toast.id}
            toast={toast}
            duration={duration}
            onClose={() => closeMessage(toast.id)}
          />
        ))}
      </div>
    </>
  );
};

export default ToastView;
