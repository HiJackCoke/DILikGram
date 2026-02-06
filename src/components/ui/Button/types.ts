import type { KeysOfUnion } from "@/types/utils";
import type { ReactNode } from "react";
import type { PALETTE } from "@/constants/palette";

// Size options matching Select component
export type ButtonSize = "sm" | "md" | "lg";

// Variant options for different visual styles
export type ButtonVariant = "solid" | "outline" | "ghost" | "text";

// REQUIRED: Palette must be one of the 6 defined colors in tailwind.config.ts

// Icon positioning for text+icon buttons
export type IconPosition = "left" | "right";

// Button type attribute
export type ButtonType = "button" | "submit" | "reset";

// Button props - simplified with optional children and icon
export interface ButtonProps {
  children?: ReactNode;
  icon?: ReactNode;
  iconPosition?: IconPosition;
  palette?: KeysOfUnion<typeof PALETTE>;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  type?: ButtonType;
  className?: string;
  fullWidth?: boolean;
  "aria-label"?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// View props (internal)
export interface ButtonViewProps extends ButtonProps {
  iconOnly?: boolean;
}
