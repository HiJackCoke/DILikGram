import { useMemo } from "react";
import ButtonView from "./View";
import type { ButtonProps } from "./types";

export default function Button({
  icon,
  iconPosition = "left",
  palette,
  size,
  variant,
  type,
  disabled,
  loading,
  fullWidth,
  className,
  children,

  onClick,

  ...props
}: ButtonProps) {
  // Handle prop extraction

  // Auto-detect icon-only button: has icon but no children
  const iconOnly = Boolean(icon && !children);

  // Handle click with loading/disabled state
  const handleClick = useMemo(() => {
    if (disabled || loading) {
      return (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
      };
    }
    return onClick;
  }, [disabled, loading, onClick]);

  return (
    <ButtonView
      {...props}
      palette={palette}
      size={size}
      variant={variant}
      type={type}
      disabled={disabled || loading}
      loading={loading}
      fullWidth={fullWidth}
      className={className}
      icon={icon}
      iconPosition={iconPosition}
      iconOnly={iconOnly}
      aria-label={props["aria-label"]}
      onClick={handleClick}
    >
      {children}
    </ButtonView>
  );
}
