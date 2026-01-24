import { ChevronUp, ChevronDown } from "lucide-react";
import type { InputViewProps } from "./types";

export default function InputView({
  label,
  type = "text",
  value,
  displayValue,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  status = "default",
  errorMessage,
  isFocused,
  min,
  max,
  step,
  formatNumber,
  onChange,
  onFocus,
  onBlur,
  onIncrement,
  onDecrement,
}: InputViewProps) {
  // Status-based border colors
  const borderColor = (() => {
    if (status === "error") return "border-red-500";
    if (status === "valid") return "border-green-500";
    return "border-slate-600";
  })();

  // Focus ring colors
  const focusRingColor = (() => {
    if (status === "error") return "focus:ring-red-500";
    if (status === "valid") return "focus:ring-green-500";
    return "focus:ring-palette-primary-bg";
  })();

  return (
    <div className="">
      {/* Label */}
      <label className="block text-sm font-medium text-slate-200 transition-colors duration-200">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {/* Input */}
      <div className="relative">
        <input
          className={`
            w-full ${type === "number" ? "pr-8" : "pr-3"} pl-3 py-2
            bg-slate-700
            border ${borderColor}
            rounded-lg
            text-white
            placeholder-slate-400
            focus:outline-none
            focus:ring-2 ${focusRingColor}
            focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 ease-in-out
            ${isFocused ? "scale-[1.01]" : "scale-100"}
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
            `}
          type={type === "number" && formatNumber && !isFocused ? "text" : type}
          value={isFocused ? value : displayValue}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />

        {/* Custom number spinner buttons */}
        {type === "number" && onIncrement && onDecrement && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
            <button
              type="button"
              onClick={onIncrement}
              disabled={disabled || (max !== undefined && Number(value) >= max)}
              className="px-1 py-0.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-t transition-colors"
            >
              <ChevronUp className="w-3 h-3 text-slate-200" />
            </button>
            <button
              type="button"
              onClick={onDecrement}
              disabled={disabled || (min !== undefined && Number(value) <= min)}
              className="px-1 py-0.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-b transition-colors"
            >
              <ChevronDown className="w-3 h-3 text-slate-200" />
            </button>
          </div>
        )}

        {/* Status icon */}
        {status !== "default" && (
          <div
            className={`absolute ${
              type === "number" && onIncrement && onDecrement
                ? "right-9"
                : "right-3"
            } top-1/2 -translate-y-1/2`}
          >
            {status === "error" && (
              <svg
                className="w-5 h-5 text-red-500 animate-shake"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {status === "valid" && (
              <svg
                className="w-5 h-5 text-green-500 animate-checkmark"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {status === "error" && errorMessage && (
        <p className="text-sm text-red-400 animate-slideDown">{errorMessage}</p>
      )}
    </div>
  );
}
