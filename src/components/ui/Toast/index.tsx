"use client";
import ReactDOM from "react-dom/client";
import { v4 as uuid } from "uuid";
import ToastView from "./View";
import { ToastProps, ToastType } from "./type";

// Toast 유지 시간
const TOAST_DURATION = 4000;

/**
 * @example
 * import toast from 'components/Toast'
 *
 * return (
 *  <>
 *    <button onClick={() => toast.success('toast message')}>success</button>
 *    <button onClick={() => toast.alert('toast message')}>alert</button>
 *  </>
 * )
 */

interface ToastReturnType {
  success(message: string): void;
  alert(message: string): void;
}

declare global {
  interface Window {
    toast: ToastReturnType;
  }
  const toast: {
    success(message: string, onClick: () => void): void;
    alert(message: string, onClick: () => void): void;
  };
}

class Toast {
  #root: ReactDOM.Root | null = null;
  #toasts: ToastProps[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      let target = document.getElementById(
        "toast-provider",
      ) as HTMLElement | null;
      if (!target) {
        target = document.createElement("div");
        target.id = "toast-provider";
        target.style.position = "relative";
        target.style.zIndex = "9999";

        document.body.appendChild(target);
      }
      this.#root = ReactDOM.createRoot(target);
    }
  }

  show(type: ToastType, message: string, onClick?: () => void) {
    if (!this.#root) return;
    const id = uuid();
    const toast: ToastProps = { id, message, type };
    this.#toasts.push(toast);

    this.#root.render(
      <ToastView
        duration={TOAST_DURATION}
        toasts={this.#toasts}
        closeMessage={this.#closeMessage.bind(this)}
        onClick={onClick}
      />,
    );
    this.#autoCloseMessage(TOAST_DURATION, id);
  }

  success(message: string, onClick?: () => void) {
    this.show("success", message, onClick);
  }

  alert(message: string, onClick?: () => void) {
    this.show("alert", message, onClick);
  }

  #closeMessage(id: string) {
    const indexToDelete = this.#toasts.findIndex((toast) => toast.id === id);
    if (indexToDelete !== -1) {
      this.#toasts.splice(indexToDelete, 1);
      if (this.#root) {
        this.#root.render(
          <ToastView
            duration={TOAST_DURATION}
            toasts={this.#toasts}
            closeMessage={this.#closeMessage.bind(this)}
          />,
        );
      }
    }
  }

  #autoCloseMessage(duration: number, id: string) {
    setTimeout(() => this.#closeMessage(id), duration);
  }
}

function checkSSR() {
  if (typeof window !== "undefined") {
    const toast = new Toast();
    window.toast = toast;

    return toast;
  }

  return { success: () => {}, alert: () => {} };
}

const toast = checkSSR();

export default toast;
