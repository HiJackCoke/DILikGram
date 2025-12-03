import type { Ref } from "react";

export type InputType = "text" | "number";
export type InputStatus = "default" | "error" | "valid";

export interface BaseInputProps {
  ref?: Ref<HTMLInputElement>;
  label: string;
  value: string | number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  status?: InputStatus;
  errorMessage?: string;
  onChange: (value: string | number) => void;
}

export type TextInputProps = BaseInputProps & {
  type?: "text";
  value: string;
  onChange: (value: string) => void;
};

export type NumberInputProps = BaseInputProps & {
  type: "number";
  value: number;
  min?: number;
  max?: number;
  step?: number;
  formatNumber?: boolean;
  onChange: (value: number) => void;
};

export type InputProps = TextInputProps | NumberInputProps;

export interface InputViewProps {
  label: string;
  type?: InputType;
  value: string;
  displayValue: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  status: InputStatus;
  errorMessage?: string;
  isFocused: boolean;
  // Number-specific props
  formatNumber?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}
