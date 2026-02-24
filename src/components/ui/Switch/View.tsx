import React from "react";
import { SwitchViewProps } from "./type";

// Size configuration for different switch sizes
const SIZE_CONFIG = {
  sm: {
    track: "w-9 h-5", // 36px × 20px (compact)
    thumb: "w-4 h-4", // 16px × 16px
    label: "text-xs", // Matches Select label for sm
    gap: "gap-2", // Consistent with Button sm
    icon: "w-2.5 h-2.5", // Matches Select tagIcon for sm
    translate: "peer-checked:translate-x-4", // thumb travel distance
  },
  md: {
    track: "w-11 h-6", // 44px × 24px (current default)
    thumb: "w-5 h-5", // 20px × 20px
    label: "text-sm", // Matches Select label for md
    gap: "gap-3", // Slightly larger than current
    icon: "w-3 h-3", // Matches Select tagIcon for md
    translate: "peer-checked:translate-x-5", // thumb travel distance
  },
  lg: {
    track: "w-14 h-7", // 56px × 28px (larger touch target)
    thumb: "w-6 h-6", // 24px × 24px
    label: "text-base", // Matches Select label for lg
    gap: "gap-4", // Larger gap for visual balance
    icon: "w-4 h-4", // Matches Button icon for lg
    translate: "peer-checked:translate-x-7", // thumb travel distance
  },
} as const;

export const SwitchView: React.FC<SwitchViewProps> = ({
  checked,
  checkedIcon,
  icon,
  disabled = false,
  size = "md",
  palette = "primary",
  variant = "solid",
  id,
  className = "",
  label,
  checkedLabel,
  onInputChange,
}) => {
  const sizeClasses = SIZE_CONFIG[size];

  return (
    <label
      className={`inline-flex items-center cursor-pointer group ${sizeClasses.gap} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {/* Left Label (Off) */}
      {label && (
        <span
          className={`${sizeClasses.label} font-medium select-none ${!checked ? "text-white" : "text-gray-400"}`}
        >
          {label}
        </span>
      )}

      {/* Switch Control */}
      <div className="switch-root relative">
        <input
          type="checkbox"
          id={id}
          className="sr-only peer"
          checked={checked}
          disabled={disabled}
          onChange={onInputChange}
        />

        {/* Track */}
        <div
          className={`${sizeClasses.track} bg-gray-200 rounded-full transition-colors duration-200 ${variant === "solid" ? `peer-checked:bg-palette-${palette}-bg` : ""}`}
        />

        {/* Thumb & Ripple */}
        <div
          className={`absolute left-[2px] top-[2px] flex items-center justify-center transition-transform duration-200 ${sizeClasses.translate}`}
        >
          {/* Ripple Effect (Active) */}
          <div
            className={`ripple-effect z-10 pointer-events-none absolute w-[300%] h-[300%] rounded-full bg-current opacity-0 group-active:opacity-10 group-active:scale-125 transition-all duration-300 bg-palette-${palette}-color`}
          />

          <div
            className={`${sizeClasses.thumb} ${variant === "solid" ? "bg-white" : `bg-palette-${palette}-bg scale-150 p-0.5`} rounded-full shadow-sm flex items-center justify-center overflow-hidden`}
          >
            {checked ? checkedIcon || null : icon || null}
          </div>
        </div>
      </div>

      {/* Right Label (On) */}
      {checkedLabel && (
        <span
          className={`${sizeClasses.label} font-medium select-none ${checked ? "text-white" : "text-gray-400"}`}
        >
          {checkedLabel}
        </span>
      )}
    </label>
  );
};
