import { useEffect, useRef } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import type { SelectViewProps, SelectOption, Mode, SelectSize } from "./types";

// Size configuration for different select sizes
const SIZE_CONFIG = {
  sm: {
    trigger: "px-2 py-1 text-sm",
    label: "text-xs",
    tag: "px-1.5 py-0.5 text-xs",
    tagIcon: "w-2.5 h-2.5",
    option: "px-3 py-1.5 text-sm",
    chevron: "w-3.5 h-3.5 right-2",
    statusIcon: "w-4 h-4 right-8",
    searchInput: "px-2 py-1.5 text-sm",
  },
  md: {
    trigger: "px-3 py-2 text-base",
    label: "text-sm",
    tag: "px-2 py-1 text-sm",
    tagIcon: "w-3 h-3",
    option: "px-4 py-2.5 text-base",
    chevron: "w-4 h-4 right-3",
    statusIcon: "w-5 h-5 right-10",
    searchInput: "px-3 py-2 text-base",
  },
  lg: {
    trigger: "px-4 py-3 text-lg",
    label: "text-base",
    tag: "px-2.5 py-1.5 text-base",
    tagIcon: "w-3.5 h-3.5",
    option: "px-5 py-3 text-lg",
    chevron: "w-5 h-5 right-4",
    statusIcon: "w-6 h-6 right-12",
    searchInput: "px-4 py-2.5 text-lg",
  },
} as const;

// Calculate padding-right to protect icon area
function getPaddingRight(size: SelectSize, hasStatusIcon: boolean): string {
  const baseValues = {
    sm: hasStatusIcon ? "pr-16" : "pr-8",
    md: hasStatusIcon ? "pr-20" : "pr-10",
    lg: hasStatusIcon ? "pr-24" : "pr-12",
  };
  return baseValues[size];
}

interface TagProps {
  label: string;
  disabled?: boolean;
  size: SelectSize;

  onRemove: () => void;
}

interface OptionItemProps<T> {
  option: SelectOption<T>;
  isSelected: boolean;
  isFocused: boolean;
  mode: Mode;
  size: SelectSize;

  onClick: () => void;
}

// Tag component for multi-select
function Tag({ label, disabled, size, onRemove }: TagProps) {
  const sizeClasses = SIZE_CONFIG[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${sizeClasses.tag} bg-palette-primary-bg rounded text-white`}
    >
      <span className="truncate">{label}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:bg-palette-primary-border rounded-full p-0.5 transition-colors flex-shrink-0"
        >
          <X className={sizeClasses.tagIcon} />
        </button>
      )}
    </div>
  );
}

// Option Item component
function OptionItem<T>({
  option,
  isSelected,
  isFocused,
  mode,
  size,
  onClick,
}: OptionItemProps<T>) {
  const optionRef = useRef<HTMLDivElement>(null);
  const sizeClasses = SIZE_CONFIG[size];

  // Scroll into view when focused
  useEffect(() => {
    if (isFocused && optionRef.current) {
      optionRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isFocused]);

  return (
    <div
      ref={optionRef}
      onClick={onClick}
      className={`
        ${sizeClasses.option}
        flex items-center gap-3
        cursor-pointer
        transition-colors
        ${
          option.disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-slate-600"
        }
        ${isSelected ? "bg-slate-500" : ""}
        ${isFocused ? "bg-slate-600" : ""}
      `}
    >
      {/* Checkbox for multi-select */}
      {mode === "multiple" && (
        <div
          className={`
          w-4 h-4 border-2 rounded
          flex items-center justify-center flex-shrink-0
          ${
            isSelected
              ? "bg-palette-primary-bg border-palette-primary-bg"
              : "border-slate-400"
          }
        `}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Option label */}
      <div className="flex-1 text-white truncate">{option.label}</div>

      {/* Checkmark for single-select */}
      {mode === "single" && isSelected && (
        <Check className="w-4 h-4 text-palette-primary-bg flex-shrink-0" />
      )}
    </div>
  );
}

export default function SelectView<T = string>({
  label = "",
  displayValue,
  placeholder,
  required = false,
  disabled = false,
  status = "default",
  errorMessage,
  show,
  focusedIndex,

  options,
  filteredOptions,
  selectedValues,
  searchable = false,
  searchQuery,
  searchPlaceholder = "Search...",
  maxHeight = 300,
  mode = "single",
  size = "md",

  dropdownRef,
  searchInputRef,

  onTriggerClick,
  onSearchChange,
  onOptionClick,
  onRemoveTag,
  onKeyDown,
  onBlur,
}: SelectViewProps<T>) {
  const sizeClasses = SIZE_CONFIG[size];
  const hasStatusIcon = status !== "default";
  const paddingRight = getPaddingRight(size, hasStatusIcon);

  // Helper to get option label by value
  const getOptionLabel = (value: T): string => {
    const option = options.find((o) => o.value === value);
    return option?.label || String(value);
  };

  // Status-based border colors for multi-select tags display
  const borderColor = (() => {
    if (status === "error") return "border-red-500";
    if (status === "valid") return "border-green-500";
    return "border-slate-600";
  })();

  return (
    // SINGLE onKeyDown location - wrapper div
    <div
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      tabIndex={-1}
    >
      {/* Unified Trigger for Single and Multi modes */}
      <div>
        {/* Label */}
        <label
          className={`block ${sizeClasses.label} font-medium text-slate-200 transition-colors duration-200`}
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>

        {/* Trigger Container */}
        <div
          onClick={disabled ? undefined : onTriggerClick}
          className={`
            relative w-full ${sizeClasses.trigger}
            bg-slate-700
            border ${borderColor}
            rounded-lg
            transition-all duration-200
            ${show ? "ring-2 ring-palette-primary-bg border-transparent scale-[1.01]" : ""}
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {/* Content: Display value, placeholder, or tags */}
          {mode === "multiple" && selectedValues.length > 0 ? (
            // Multi-select with tags
            <div className={`flex flex-wrap gap-1.5 ${paddingRight}`}>
              {selectedValues.slice(0, 3).map((value) => (
                <Tag
                  key={String(value)}
                  label={getOptionLabel(value)}
                  size={size}
                  onRemove={() => onRemoveTag(value)}
                  disabled={disabled}
                />
              ))}
              {selectedValues.length > 3 && (
                <span
                  className={`${sizeClasses.trigger.split(" ")[2]} text-slate-400`}
                >
                  +{selectedValues.length - 3} more
                </span>
              )}
            </div>
          ) : (
            // Single-select or empty multi-select: show text
            <div
              className={`truncate ${paddingRight} ${displayValue ? "text-white" : "text-slate-400"}`}
            >
              {displayValue || placeholder}
            </div>
          )}

          {/* Chevron Icon (always show) */}
          <div
            className={`absolute ${sizeClasses.chevron} top-1/2 -translate-y-1/2 pointer-events-none`}
          >
            <ChevronDown
              className={`
                ${sizeClasses.chevron.split(" ").slice(0, 2).join(" ")} text-slate-400
                transition-transform duration-200
                ${show ? "rotate-180" : ""}
              `}
            />
          </div>

          {/* Status Icon */}
          {status !== "default" && (
            <div
              className={`absolute ${sizeClasses.statusIcon} top-1/2 -translate-y-1/2`}
            >
              {status === "error" && (
                <svg
                  className={`${sizeClasses.statusIcon.split(" ").slice(0, 2).join(" ")} text-red-500`}
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
                  className={`${sizeClasses.statusIcon.split(" ").slice(0, 2).join(" ")} text-green-500`}
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

        {/* Error Message */}
        {status === "error" && errorMessage && (
          <p className="text-sm text-red-400 animate-slideDown mt-1.5">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Dropdown */}
      {show && (
        <div
          ref={dropdownRef}
          tabIndex={-1}
          className="
            absolute top-full left-0 right-0 mt-1
            bg-slate-700
            border border-slate-600
            rounded-lg
            shadow-xl
            z-50
            overflow-hidden
            animate-slideDown
            origin-top
          "
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-slate-600">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder || "Search..."}
                className={`w-full ${sizeClasses.searchInput} bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-palette-primary-bg transition-all duration-200`}
              />
            </div>
          )}

          {/* Options List */}
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: `${maxHeight - (searchable ? 60 : 0)}px`,
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                className={`${sizeClasses.option} text-slate-400 text-center`}
              >
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <OptionItem
                  key={String(option.value)}
                  option={option}
                  isSelected={selectedValues.includes(option.value)}
                  isFocused={index === focusedIndex}
                  mode={mode}
                  size={size}
                  onClick={() => onOptionClick(option)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
