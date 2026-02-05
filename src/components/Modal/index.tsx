"use client";

import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

import ModalView from "./View";

import type { ModalProps } from "@/types/modal";

import "@/styles/modal.css";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";

export default function Modal({
  show,
  title = "",
  description = "",
  selector = "#modal-root",
  children,
  onClose,
}: ModalProps) {
  const element = useBrowserEnv(
    ({ document }) => document.querySelector(selector),
    null,
  );

  const [clear, setClear] = useState(element ? false : true);

  useEffect(() => {
    if (!element) return;

    const handleOnAnimationStart = () => {
      if (!show) return;
      setClear(false);
    };

    const handleOnAnimationEnd = () => {
      if (show) return;
      setClear(true);
    };

    if (show) {
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
  }, [show]);

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
            {show && children}
          </ModalView>
        </div>
      ),
      element,
    )
  );
}
