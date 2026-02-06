"use client";

import { useEffect } from "react";

import toast from "@/components/ui/Toast";

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
