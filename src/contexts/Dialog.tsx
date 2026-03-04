"use client";

import Dialog from "@/components/ui/Dialog";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";

import type { ReactNode } from "react";

export default function DialogProvider({ children }: { children: ReactNode }) {
  useBrowserEnv(({ document }) => {
    const root = document.querySelector("#dialog");
    if (typeof window !== "undefined") {
      if (root) {
        if (window.dialog === root) window.dialog = new Dialog();
      }
    }
  }, null);

  return (
    <>
      <div id="dialog" />
      {children}
    </>
  );
}
