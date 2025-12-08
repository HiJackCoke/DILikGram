import type { Ref } from "react";

export type InputType = "text" | "number";
export type InputStatus = "default" | "error" | "valid";

interface BaseInputProps {
  label?: string;
  value: string | number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  status?: InputStatus;
  errorMessage?: string;
}

export interface CoreInputProps extends BaseInputProps {
  ref?: Ref<HTMLInputElement>;
  onChange?: (value: string | number) => void;
}

export type TextInputProps = CoreInputProps & {
  type?: "text";
  value: string;
  onChange?: (value: string) => void;
};

export type NumberInputProps = CoreInputProps & {
  type: "number";
  value: number;
  min?: number;
  max?: number;
  step?: number;
  formatNumber?: boolean;
  onChange?: (value: number) => void;
};

export type InputProps = TextInputProps | NumberInputProps;

export interface InputViewProps extends BaseInputProps {
  type?: InputType;
  isFocused: boolean;
  displayValue: string;
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
