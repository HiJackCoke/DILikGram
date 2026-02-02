"use client";

import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

import ModalView from "./View";

import type { ModalProps } from "@/types/modal";

import "@/styles/modal.css";
import { useBrowserEnv } from "@/hooks/useBrowerEnv";

export default function Modal({
  open,
  title = "",
  description = "",
  selector = "#modal-root",
  children,
  onClose,
}: ModalProps) {
  const element = useBrowserEnv(
    ({ document }) => document.querySelector(selector),
    null
  );

  const [clear, setClear] = useState(element ? false : true);

  useEffect(() => {
    if (!element) return;

    const handleOnAnimationStart = () => {
      if (!open) return;
      setClear(false);
    };

    const handleOnAnimationEnd = () => {
      if (open) return;
      setClear(true);
    };

    if (open) {
      element.classList.remove("inactive");
      element.classList.add(`active`);
    } else if (element.classList.contains("active")) {
      element.classList.add("inactive");
      element.classList.remove("active");
    }

    element.addEventListener("animationstart", handleOnAnimationStart);
    element.addEventListener("animationend", handleOnAnimationEnd);

    return () => {
      element.removeEventListener("animationstart", handleOnAnimationStart);
      element.removeEventListener("animationend", handleOnAnimationEnd);
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    element &&
    ReactDOM.createPortal(
      clear ? null : (
        <div className="modal-container" onMouseDown={handleBackdropClick}>
          <ModalView title={title} description={description} onClose={onClose}>
            {open && children}
          </ModalView>
        </div>
      ),
      element
    )
  );
}
