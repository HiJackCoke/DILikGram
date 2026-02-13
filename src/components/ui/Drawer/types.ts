import type { ReactNode, CSSProperties } from "react";

export type DrawerPosition = "left" | "right" | "bottom" | "top";

export type DrawerState = "active" | "inactive" | "hidden";

interface CommonProps {
  children: ReactNode;
  portal?: boolean;
  position?: DrawerPosition; // Default: "right"
  width?: string; // Default: "384px" (w-96)
  height?: string; // Default: "50vh"

  // Backdrop
  mask?: boolean; // Default: true
  maskClosable?: boolean; // Default: true
  zIndex?: number; // Default: 1000

  // Content
  title?: ReactNode;
  footer?: ReactNode;

  // Styling
  className?: string;
  bodyStyle?: CSSProperties;

  onClose: () => void;
}

export interface DrawerProps extends CommonProps {
  selector?: string;
  show: boolean;

  // Interaction
  keyboard?: boolean; // ESC to close, Default: true

  afterOpenChange?: (open: boolean) => void;
}

export interface DrawerViewProps extends CommonProps {
  state: DrawerState;
  onBackdropClick: () => void;
}
