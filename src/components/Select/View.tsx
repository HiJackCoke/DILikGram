import { useEffect, useRef } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import type { SelectViewProps, SelectOption, Mode } from "./types";

interface TagProps {
  label: string;
  disabled?: boolean;

  onRemove: () => void;
}

interface OptionItemProps<T> {
  option: SelectOption<T>;
  isSelected: boolean;
  isFocused: boolean;
  mode: Mode;

  onClick: () => void;
}

// Tag component for multi-select
function Tag({ label, disabled, onRemove }: TagProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-palette-primary-bg rounded text-white text-sm">
      <span>{label}</span>
      {!disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:bg-palette-primary-border rounded-full p-0.5 transition-colors"
        >
          <X className="w-3 h-3" />
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
  onClick,
}: OptionItemProps<T>) {
  const optionRef = useRef<HTMLDivElement>(null);

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
        px-4 py-2.5
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
          flex items-center justify-center
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
      <div className="flex-1 text-white">{option.label}</div>

      {/* Checkmark for single-select */}
      {mode === "single" && isSelected && (
        <Check className="w-4 h-4 text-palette-primary-bg" />
      )}
    </div>
  );
}

export default function SelectView<T = string>({
  label,
  displayValue,
  placeholder,
  required = false,
  disabled = false,
  status = "default",
  errorMessage,
  isOpen,
  focusedIndex,

  options,
  filteredOptions,
  selectedValues,
  searchable,
  searchQuery,
  searchPlaceholder = "Search...",
  maxHeight = 300,
  mode,

  dropdownRef,
  searchInputRef,

  onTriggerClick,
  onSearchChange,
  onOptionClick,
  onRemoveTag,
  onKeyDown,
  onBlur,
}: SelectViewProps<T>) {
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
        <label className="block text-sm font-medium text-slate-200 transition-colors duration-200">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>

        {/* Trigger Container */}
        <div
          onClick={disabled ? undefined : onTriggerClick}
          className={`
            relative w-full px-3 py-2 mt-1.5
            bg-slate-700
            border ${borderColor}
            rounded-lg
            transition-all duration-200
            ${isOpen ? "ring-2 ring-palette-primary-bg border-transparent scale-[1.01]" : ""}
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          {/* Content: Display value, placeholder, or tags */}
          {mode === "multiple" && selectedValues.length > 0 ? (
            // Multi-select with tags
            <div className="flex flex-wrap gap-1.5">
              {selectedValues.slice(0, 3).map((value) => (
                <Tag
                  key={String(value)}
                  label={getOptionLabel(value)}
                  onRemove={() => onRemoveTag(value)}
                  disabled={disabled}
                />
              ))}
              {selectedValues.length > 3 && (
                <span className="text-sm text-slate-400">
                  +{selectedValues.length - 3} more
                </span>
              )}
            </div>
          ) : (
            // Single-select or empty multi-select: show text
            <div className={displayValue ? "text-white" : "text-slate-400"}>
              {displayValue || placeholder}
            </div>
          )}

          {/* Chevron Icon (always show) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown
              className={`
                w-4 h-4 text-slate-400
                transition-transform duration-200
                ${isOpen ? "rotate-180" : ""}
              `}
            />
          </div>

          {/* Status Icon */}
          {status !== "default" && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              {status === "error" && (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {status === "valid" && (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
      {isOpen && (
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
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-palette-primary-bg transition-all duration-200"
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
              <div className="px-4 py-3 text-slate-400 text-center text-sm">
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
