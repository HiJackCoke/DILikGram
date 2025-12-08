export type TextAreaStatus = "default" | "error" | "valid";

export interface BaseTextAreaProps {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  status?: TextAreaStatus;
  errorMessage?: string;
  rows?: number;
  maxLength?: number;
}
export interface TextAreaProps extends BaseTextAreaProps {
  onChange: (value: string) => void;
}

export interface TextAreaViewProps extends BaseTextAreaProps {
  isFocused: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}
