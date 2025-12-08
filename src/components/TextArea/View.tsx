import type { TextAreaViewProps } from "./types";

export default function TextAreaView({
  label,
  value,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  status = "default",
  errorMessage,
  isFocused,
  rows = 3,
  maxLength,
  onChange,
  onFocus,
  onBlur,
}: TextAreaViewProps) {
  // Status-based border colors (same as Input)
  const borderColor = (() => {
    if (status === "error") return "border-red-500";
    if (status === "valid") return "border-green-500";
    return "border-slate-600";
  })();

  // Focus ring colors (same as Input)
  const focusRingColor = (() => {
    if (status === "error") return "focus:ring-red-500";
    if (status === "valid") return "focus:ring-green-500";
    return "focus:ring-palette-primary-bg";
  })();

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label className="block text-sm font-medium text-slate-200 transition-colors duration-200">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {/* TextArea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={`
            w-full px-3 py-2
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
            resize-none
          `}
        />

        {/* Status icon (positioned at top-right) */}
        {status !== "default" && (
          <div className="absolute right-3 top-3">
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
