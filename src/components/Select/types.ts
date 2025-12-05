export type SelectStatus = "default" | "error" | "valid";
export type Mode = "single" | "multiple";

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

// Base props shared by single and multi-select
interface BaseSelectProps<T = string> {
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  status?: SelectStatus;
  errorMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  maxHeight?: number;
  options: SelectOption<T>[];
}

// Single-select mode (discriminated union)
export type SingleSelectProps<T = string> = BaseSelectProps<T> & {
  mode?: "single";
  value: T | null;
  onChange: (value: T | null) => void;
};

// Multi-select mode (discriminated union)
export type MultiSelectProps<T = string> = BaseSelectProps<T> & {
  mode: "multiple";
  value: T[];
  maxSelections?: number;
  onChange: (value: T[]) => void;
};

export type SelectProps<T = string> =
  | SingleSelectProps<T>
  | MultiSelectProps<T>;

// Internal view props
export interface SelectViewProps<T = string> extends BaseSelectProps<T> {
  displayValue: string;
  isOpen: boolean;
  focusedIndex: number;

  filteredOptions: SelectOption<T>[];
  selectedValues: T[];
  searchQuery: string;

  mode: Mode;

  dropdownRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;

  onTriggerClick: () => void;
  onSearchChange: (query: string) => void;
  onOptionClick: (option: SelectOption<T>) => void;
  onRemoveTag: (value: T) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
}
