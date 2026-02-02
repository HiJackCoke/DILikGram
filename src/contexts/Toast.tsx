'use client';

import toast from "@/components/Toast";
import { useEffect } from "react";
import type { ReactNode } from "react";

export default function ToastProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.querySelector("#toast");
    if (typeof window !== "undefined") {
      if (root) {
        window.toast = toast;
      }
    }
  }, []);

  return (
    <>
      <div id="toast" />
      {children}
    </>
  );
}
