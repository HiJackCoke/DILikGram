export type ToastType = "success" | "alert";

export interface ToastMessageProps {
toast: ToastProps;
  duration: number;
  onClose: () => void;
  onClick?: () => void;
}

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
}

export interface ToastViewProps
  extends Pick<ToastMessageProps, "duration" | "onClick"> {
  toasts: ToastProps[];
  closeMessage: (id: string) => void;
}
