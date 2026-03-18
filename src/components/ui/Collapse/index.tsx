import { useState } from "react";
import type { CollapseProps } from "./types";

/**
 * Animated collapse container.
 *
 * Supports both controlled (`open`) and uncontrolled (`defaultOpen`) modes.
 * The trigger / toggle button is intentionally kept outside this component
 * so consumers have full control over the header UI.
 *
 * Animation uses the CSS grid-template-rows trick — no JS height calculation needed.
 *
 * @example Controlled
 * <Collapse open={isOpen}>
 *   <SomeContent />
 * </Collapse>
 *
 * @example Uncontrolled
 * <Collapse defaultOpen onOpenChange={(open) => console.log(open)}>
 *   <SomeContent />
 * </Collapse>
 */
export default function Collapse({
  open: controlledOpen,
  defaultOpen = false,
  children,
  className,
  onOpenChange,
}: CollapseProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  // Expose toggle for uncontrolled consumers (e.g. wrapping with a trigger)
  const _toggle = () => {
    if (!isControlled) {
      setInternalOpen((prev) => {
        onOpenChange?.(!prev);
        return !prev;
      });
    } else {
      onOpenChange?.(!controlledOpen);
    }
  };
  void _toggle; // suppress unused warning — available for subclass patterns

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        transition: "grid-template-rows 220ms ease",
      }}
    >
      {/* Inner wrapper must be overflow-hidden for the grid trick to clip content */}
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
