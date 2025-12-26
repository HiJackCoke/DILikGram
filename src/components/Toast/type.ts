export type ToastType = 'success' | 'alert';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
}

export interface StyleProps {
  duration: number;
  toastType: ToastType;
}

export interface ToastViewProps extends Pick<StyleProps, 'duration'> {
  toasts: ToastProps[];
  closeMessage: (id: string) => void;
}
