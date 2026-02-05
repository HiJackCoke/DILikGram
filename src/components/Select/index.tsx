import { useState, useLayoutEffect, useMemo, useRef } from "react";
import SelectView from "./View";
import type { SelectProps, SelectOption } from "./types";

export default function Select<T = string>(props: SelectProps<T>) {
  const {
    label,
    placeholder,
    required,
    disabled,
    status,
    errorMessage,
    options,
    searchable,
    searchPlaceholder,
    maxHeight,
    mode,
    size,
    value,
    onChange,
  } = props;

  const [show, setShow] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndexState, setFocusedIndexState] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get selected values as array for consistent handling
  const selectedValues = useMemo(() => {
    if (mode === "multiple") {
      return value;
    } else {
      return value !== null ? [value] : [];
    }
  }, [mode, value]);

  const filteredOptions = searchQuery.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;
  const maxIndex = Math.max(0, filteredOptions.length - 1);
  const focusedIndex = Math.min(focusedIndexState ?? 0, maxIndex);

  // Display value formatting
  const displayValue = useMemo(() => {
    if (mode === "multiple") {
      const count = value.length;
      if (count === 0) return "";
      if (count === 1) {
        const option = options.find((o) => o.value === value[0]);
        return option?.label || "";
      }
      return `${count} items selected`;
    } else {
      if (!value) return "";
      const option = options.find((o) => o.value === value);
      return option?.label || "";
    }
  }, [value, options, mode]);

  // Click-outside detection using onBlur
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Close dropdown if focus moves completely outside the Select component
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setShow(false);
      setSearchQuery("");
      setFocusedIndexState(0);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndexState((prev) =>
          Math.min(prev + 1, filteredOptions.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndexState((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[focusedIndex]) {
          handleOptionClick(filteredOptions[focusedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShow(false);
        setSearchQuery("");
        break;
    }
  };

  // Auto-focus search input or dropdown when it opens
  useLayoutEffect(() => {
    if (show) {
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      } else if (dropdownRef.current) {
        dropdownRef.current.focus();
      }
    }
  }, [show, searchable]);

  const handleTriggerClick = () => {
    setShow(!show);
    if (!show) {
      setSearchQuery("");
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setFocusedIndexState(0); // Reset focus when filtering
  };

  const handleOptionClick = (option: SelectOption<T>) => {
    if (option.disabled) return;

    if (mode === "multiple") {
      const isSelected = value.includes(option.value);

      if (isSelected) {
        // Remove from selection
        onChange(value.filter((v) => v !== option.value));
      } else {
        // Add to selection (check maxSelections)
        if (props.maxSelections && value.length >= props.maxSelections) {
          return; // Already at max
        }
        onChange([...value, option.value]);
      }
      // Keep dropdown open in multiple-select
    } else {
      onChange(option.value);
      setShow(false);
      setSearchQuery("");
    }
  };

  const handleRemoveTag = (tag: T) => {
    if (mode === "multiple") {
      onChange(value.filter((v) => v !== tag));
    }
  };

  return (
    <SelectView
      label={label}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      status={status}
      errorMessage={errorMessage}
      options={options}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      maxHeight={maxHeight}
      mode={mode}
      size={size}
      displayValue={displayValue}
      show={show}
      focusedIndex={focusedIndex}
      filteredOptions={filteredOptions}
      selectedValues={selectedValues}
      searchQuery={searchQuery}
      dropdownRef={dropdownRef}
      searchInputRef={searchInputRef}
      onTriggerClick={handleTriggerClick}
      onSearchChange={handleSearchChange}
      onOptionClick={handleOptionClick}
      onRemoveTag={handleRemoveTag}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
}
