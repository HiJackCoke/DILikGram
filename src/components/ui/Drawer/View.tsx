import { X } from "lucide-react";
import type { DrawerViewProps } from "./types";

export default function DrawerView({
  zIndex = 1000,
  className = "",
  portal,
  state,
  position,
  width,
  height,
  mask,
  maskClosable,
  title,
  footer,
  bodyStyle,
  children,
  onClose,
  onBackdropClick,
}: DrawerViewProps) {
  const isHorizontal = position === "left" || position === "right";
  const panelStyle = {
    zIndex,
    ...(isHorizontal ? { width } : { height }),
  };

  const panelClasses = [
    "drawer-panel",
    `drawer-${position}`,
    state && `drawer-${state}-${position}`,
    !portal && "absolute",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const backdropClasses = [
    "drawer-backdrop",
    state && `drawer-backdrop-${state}`,
    !portal && "absolute",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Backdrop */}
      {mask && (
        <div
          className={backdropClasses}
          style={{ zIndex: zIndex - 1 }}
          onMouseDown={maskClosable ? onBackdropClick : undefined}
        />
      )}

      {/* Drawer Panel */}
      <div className={panelClasses} style={panelStyle}>
        {/* Header */}
        {title && (
          <div className="drawer-header flex items-center justify-between px-6 py-4 border-b">
            <div className="drawer-title text-lg font-medium">{title}</div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div
          className="drawer-body flex-1 overflow-y-auto px-6 py-4"
          style={bodyStyle}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="drawer-footer px-6 py-4 border-t">{footer}</div>
        )}
      </div>
    </>
  );
}
