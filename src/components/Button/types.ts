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

// Base props shared by all button variants
interface BaseButtonProps {
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

// Text-only button (no icon)
export interface TextButtonProps extends BaseButtonProps {
  children: ReactNode;
  icon?: never;
  iconPosition?: never;
  iconOnly?: never;
}

// Text + Icon button
export interface TextIconButtonProps extends BaseButtonProps {
  children: ReactNode;
  icon: ReactNode;
  iconPosition?: IconPosition;
  iconOnly?: never;
}

// Icon-only button (REQUIRES aria-label for accessibility)
export interface IconOnlyButtonProps extends BaseButtonProps {
  children?: never;
  icon: ReactNode;
  iconOnly: true;
}

// Discriminated union for type safety
export type ButtonProps =
  | TextButtonProps
  | TextIconButtonProps
  | IconOnlyButtonProps;

// View props (internal)
export interface ButtonViewProps extends BaseButtonProps {
  children?: ReactNode;
  icon?: ReactNode;
  iconPosition?: IconPosition;
  iconOnly?: boolean;
}
