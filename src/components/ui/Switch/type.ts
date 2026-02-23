import { ReactNode, ChangeEvent } from "react";

export type SwitchSize = "sm" | "md" | "lg";

export type SwitchPalette =
  | "primary"
  | "neutral"
  | "success"
  | "danger"
  | "warning"
  | "secondary";

export type SwitchVariant = "solid" | "icon";

export interface SwitchProps {
  id?: string;
  palette?: SwitchPalette;
  variant?: SwitchVariant;
  size?: SwitchSize;

  checked?: boolean;
  label?: string;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;

  checkedIcon?: ReactNode;
  checkedLabel?: string;

  onChange?: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
}

export interface SwitchViewProps extends Omit<SwitchProps, "onChange"> {
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}
