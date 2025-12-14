import { useMemo } from "react";
import ButtonView from "./View";
import type { ButtonProps } from "./types";

export default function Button(props: ButtonProps) {
  // Extract props with defaults
  const {
    palette,
    size,
    variant,
    type,
    disabled,
    loading,
    fullWidth,
    className,
    onClick,
  } = props;

  // Handle discriminated union prop extraction
  const icon = "icon" in props ? props.icon : undefined;
  const iconPosition =
    "iconPosition" in props ? props.iconPosition || "left" : undefined;
  const iconOnly = "iconOnly" in props ? props.iconOnly : false;
  const children = "children" in props ? props.children : undefined;
  const ariaLabel = props["aria-label"];

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
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      {children}
    </ButtonView>
  );
}
