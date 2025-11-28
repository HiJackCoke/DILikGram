import type { ReactNode } from "react";

export interface ModalViewProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
}

export interface ModalProps extends ModalViewProps {
  open: boolean;
  selector?: string;
}
