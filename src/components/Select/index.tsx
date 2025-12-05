import { useState, useLayoutEffect, useMemo, useRef } from "react";
import SelectView from "./View";
import type { SelectProps, SelectOption } from "./types";

export default function Select<T = string>(props: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndexState, setFocusedIndexState] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get selected values as array for consistent handling
  const selectedValues = useMemo(() => {
    if (props.mode === "multiple") {
      return props.value;
    } else {
      return props.value !== null ? [props.value] : [];
    }
  }, [props.mode, props.value]);

  const filteredOptions = searchQuery.trim()
    ? props.options.filter((o) =>
        o.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : props.options;
  const maxIndex = Math.max(0, filteredOptions.length - 1);
  const focusedIndex = Math.min(focusedIndexState ?? 0, maxIndex);

  // Display value formatting
  const displayValue = useMemo(() => {
    if (props.mode === "multiple") {
      const count = props.value.length;
      if (count === 0) return "";
      if (count === 1) {
        const option = props.options.find((o) => o.value === props.value[0]);
        return option?.label || "";
      }
      return `${count} items selected`;
    } else {
      if (!props.value) return "";
      const option = props.options.find((o) => o.value === props.value);
      return option?.label || "";
    }
  }, [props.value, props.options, props.mode]);

  // Click-outside detection using onBlur
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Close dropdown if focus moves completely outside the Select component
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
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
        setIsOpen(false);
        setSearchQuery("");
        break;
    }
  };

  // Auto-focus search input or dropdown when it opens
  useLayoutEffect(() => {
    if (isOpen) {
      if (props.searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      } else if (dropdownRef.current) {
        dropdownRef.current.focus();
      }
    }
  }, [isOpen, props.searchable]);

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setFocusedIndexState(0); // Reset focus when filtering
  };

  const handleOptionClick = (option: SelectOption<T>) => {
    if (option.disabled) return;

    if (props.mode === "multiple") {
      const isSelected = props.value.includes(option.value);

      if (isSelected) {
        // Remove from selection
        props.onChange(props.value.filter((v) => v !== option.value));
      } else {
        // Add to selection (check maxSelections)
        if (props.maxSelections && props.value.length >= props.maxSelections) {
          return; // Already at max
        }
        props.onChange([...props.value, option.value]);
      }
      // Keep dropdown open in multiple-select
    } else {
      props.onChange(option.value);
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const handleRemoveTag = (value: T) => {
    if (props.mode === "multiple") {
      props.onChange(props.value.filter((v) => v !== value));
    }
  };

  return (
    <SelectView
      label={props.label}
      displayValue={displayValue}
      placeholder={props.placeholder}
      required={props.required}
      disabled={props.disabled}
      status={props.status || "default"}
      errorMessage={props.errorMessage}
      isOpen={isOpen}
      focusedIndex={focusedIndex}
      options={props.options}
      filteredOptions={filteredOptions}
      selectedValues={selectedValues}
      searchable={props.searchable || false}
      searchQuery={searchQuery}
      searchPlaceholder={props.searchPlaceholder}
      maxHeight={props.maxHeight}
      mode={props.mode || "single"}
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
