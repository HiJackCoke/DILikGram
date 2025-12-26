"use client";
import ReactDOM from "react-dom/client";
import { v4 as uuid } from "uuid";

import ToastView from "@/components/Toast/View";
import type { ToastProps, ToastType } from "@/components/Toast/type";

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
    success(message: string): void;
    alert(message: string): void;
  };
}

class Toast {
  #root: ReactDOM.Root | null = null;
  #toasts: ToastProps[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      let target = document.getElementById(
        "toast-provider"
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

  show(type: ToastType, message: string) {
    if (!this.#root) return;
    const id = uuid();
    const toast: ToastProps = { id, message, type };
    this.#toasts.push(toast);

    this.#root.render(
      <ToastView
        duration={TOAST_DURATION}
        toasts={this.#toasts}
        closeMessage={this.#closeMessage.bind(this)}
      />
    );
    this.#autoCloseMessage(TOAST_DURATION, id);
  }

  success(message: string) {
    this.show("success", message);
  }

  alert(message: string) {
    this.show("alert", message);
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
          />
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
