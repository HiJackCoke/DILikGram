import type { ReactNode } from "react";

export type CollapseProps = {
  /** Controlled open state */
  open?: boolean;
  /** Uncontrolled initial open state */
  defaultOpen?: boolean;
  /** Called when open state changes (uncontrolled mode) */
  children: ReactNode;
  /** Applied to the animated content wrapper */
  className?: string;
  onOpenChange?: (open: boolean) => void;
};
