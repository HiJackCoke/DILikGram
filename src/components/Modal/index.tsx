import { useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import ModalView from "./View";

import type { ModalProps } from "@/types/modal";

import "@/styles/modal.css";

export default function Modal({
  open,
  title = "",
  description = "",
  selector = "#modal-root",
  children,
  onClose,
}: ModalProps) {
  const element = useMemo(() => document.querySelector(selector), [selector]);

  useEffect(() => {
    if (!element) return;
    if (open) {
      element.classList.remove("inactive");
      element.classList.add(`active`);
    } else {
      element.classList.add("inactive");
      element.classList.remove("active");
    }
  }, [element, open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    element &&
    ReactDOM.createPortal(
      <div
        className={`modal-container ${open ? "active" : "inactive"}`}
        onClick={handleBackdropClick}
      >
        <ModalView title={title} description={description} onClose={onClose}>
          {open && children}
        </ModalView>
      </div>,
      element
    )
  );
}
