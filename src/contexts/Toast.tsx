"use client";

// import { useEffect } from "react";

import Toast from "@/components/ui/Toast";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";

import type { ReactNode } from "react";

export default function ToastProvider({ children }: { children: ReactNode }) {
  useBrowserEnv(({ document }) => {
    const root = document.querySelector("#toast");
    if (typeof window !== "undefined") {
      if (root) {
        window.toast = Toast;
      }
    }
  }, null);

  return (
    <>
      <div id="toast" />
      {children}
    </>
  );
}
