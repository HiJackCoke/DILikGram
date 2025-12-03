export type TextAreaStatus = "default" | "error" | "valid";

export interface TextAreaProps {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  status?: TextAreaStatus;
  errorMessage?: string;
  rows?: number;
  maxLength?: number;
  onChange: (value: string) => void;
}

export interface TextAreaViewProps {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  status: TextAreaStatus;
  errorMessage?: string;
  isFocused: boolean;
  rows?: number;
  maxLength?: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}
