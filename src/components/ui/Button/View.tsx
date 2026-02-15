import { PALETTE } from "@/constants/palette";
import type { ButtonViewProps } from "./types";

// Size configuration for different button sizes
const SIZE_CONFIG = {
  sm: {
    base: "px-2 py-1 text-sm",
    iconOnly: "p-1.5",
    icon: "w-3.5 h-3.5",
    gap: "gap-1.5",
  },
  md: {
    base: "px-4 py-2 text-base",
    iconOnly: "p-2",
    icon: "w-4 h-4",
    gap: "gap-2",
  },
  lg: {
    base: "px-6 py-3 text-lg",
    iconOnly: "p-3",
    icon: "w-5 h-5",
    gap: "gap-2.5",
  },
} as const;

// Variant configuration for different visual styles
const VARIANT_CONFIG = {
  solid: {
    base: "border border-transparent",
    normal:
      "bg-[var(--btn-bg)] hover:bg-[var(--btn-color)] active:bg-[var(--btn-active)]",
    disabled: "bg-gray-400 cursor-not-allowed opacity-60",
    text: "text-white",
  },
  outline: {
    base: "border-2",
    normal:
      "border-[var(--btn-bg)] bg-transparent hover:border-[var(--btn-color)] hover:text-[var(--btn-color)] active:bg-[var(--btn-border)]/20",
    disabled: "border-gray-600 cursor-not-allowed opacity-50",
    text: "text-[var(--btn-bg)] disabled:text-palette-neutral-bg",
  },
  ghost: {
    base: "border border-transparent",
    normal:
      "bg-transparent hover:bg-[var(--btn-hover)] active:bg-[var(--btn-bg)]/20",
    disabled: "cursor-not-allowed opacity-50",
    text: "text-[var(--btn-bg)] disabled:text-palette-neutral-bg",
  },
  text: {
    base: "border-none",
    normal: "bg-transparent hover:text-[var(--btn-hover)]",
    disabled: "cursor-not-allowed opacity-50",
    text: "text-[var(--btn-color)] disabled:text-palette-neutral-bg",
  },
} as const;

function Loading({
  iconOnly,
  size = "md",
}: Pick<ButtonViewProps, "iconOnly" | "size">) {
  const sizeClasses = SIZE_CONFIG[size];

  return (
    <>
      <svg
        className={`${sizeClasses.icon} animate-spin`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {!iconOnly && <span>Loading...</span>}
    </>
  );
}

const Icon = ({ icon, size = "md" }: ButtonViewProps) => {
  if (!icon) return null;

  const sizeClasses = SIZE_CONFIG[size];
  return (
    <span className={`flex items-center ${sizeClasses.icon}`}>{icon}</span>
  );
};

function Content({
  children,
  loading,
  iconPosition,
  iconOnly,
  icon,
  size,
}: ButtonViewProps) {
  if (loading) return <Loading iconOnly={iconOnly} size={size} />;
  if (iconOnly) return <Icon icon={icon} size={size} />;
  if (!icon) return children;

  if (iconPosition === "right") {
    return (
      <>
        {children}
        <Icon icon={icon} size={size} />
      </>
    );
  }

  return (
    <>
      <Icon icon={icon} size={size} />
      {children}
    </>
  );
}

export default function ButtonView({
  "aria-label": ariaLabel,
  palette = "neutral",
  size = "md",
  variant = "solid",
  type = "button",
  disabled = false,
  loading = false,
  fullWidth = false,
  className = "",
  icon,
  iconPosition = "left",
  iconOnly = false,
  children,
  onClick,
}: ButtonViewProps) {
  const sizeClasses = SIZE_CONFIG[size];
  const variantClasses = VARIANT_CONFIG[variant];
  const paletteVars = PALETTE[palette];

  // CSS variables for dynamic theming
  const style = {
    "--btn-color": paletteVars.color,
    "--btn-bg": paletteVars.bg,
    "--btn-border": paletteVars.border,
    "--btn-hover": paletteVars.hover,
    "--btn-active": paletteVars.active,
  } as React.CSSProperties;

  // Base classes
  const baseClasses = `
    inline-flex items-center justify-center
    font-medium
    rounded-lg
    transition-all duration-200
    ${variantClasses.base}
    ${disabled ? variantClasses.disabled : variantClasses.normal}
    ${variantClasses.text}
    ${iconOnly ? sizeClasses.iconOnly : sizeClasses.base}
    ${icon && !iconOnly ? sizeClasses.gap : ""}
    ${fullWidth ? "w-full" : ""}
    ${className}
  `
    .trim()
    .replace(/\s+/g, " ");

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={baseClasses}
      style={style}
      aria-label={ariaLabel}
    >
      <Content
        loading={loading}
        icon={icon}
        iconPosition={iconPosition}
        iconOnly={iconOnly}
        size={size}
      >
        {children}
      </Content>
    </button>
  );
}
