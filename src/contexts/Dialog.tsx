import Dialog from "@/components/Dialog";
import { useEffect } from "react";
import type { ReactNode } from "react";

export default function DialogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.querySelector("#dialog");
    if (typeof window !== "undefined") {
      if (root) {
        if (window.dialog === root) window.dialog = new Dialog();
      }
    }
  }, []);

  return (
    <>
      <div id="dialog" />
      {children}
    </>
  );
}
