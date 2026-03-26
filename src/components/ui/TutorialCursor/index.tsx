"use client";

import { useEffect, useRef, useState } from "react";

interface TutorialCursorProps {
  /** CSS selector for the element to point at */
  targetSelector: string;
  /** Callout label shown below the cursor */
  label: string;
}

const PAD = 8; // spacing around the target element

/**
 * Onboarding spotlight cursor.
 *
 * - Dims the entire page except the target element (box-shadow spotlight)
 * - Adds a pulsing white ring around the target
 * - Shows a bouncing finger cursor + label below
 *
 * Polls every 200 ms so it stays in sync as the layout shifts.
 * Renders nothing when the target element is not yet in the DOM.
 */
export default function TutorialCursor({
  targetSelector,
  label,
}: TutorialCursorProps) {
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector(targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
      timerRef.current = setTimeout(update, 200);
    };
    update();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [targetSelector]);

  if (!rect) return null;

  const top = rect.top - PAD;
  const left = rect.left - PAD;
  const width = rect.width + PAD * 2;
  const height = rect.height + PAD * 2;

  return (
    <>
      {/*
       * Spotlight overlay
       * The div itself is transparent (background: none), so the target button
       * shows through unaffected. The massive box-shadow covers everything else.
       */}
      <div
        className="fixed pointer-events-none z-[9997] rounded-xl"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        }}
      />

      {/* Ping ring — expands outward once per cycle */}
      <div
        className="fixed pointer-events-none z-[9998] rounded-xl animate-ping"
        style={{
          top,
          left,
          width,
          height,
          border: "2px solid rgba(255,255,255,0.55)",
        }}
      />

      {/* Static ring — always visible */}
      <div
        className="fixed pointer-events-none z-[9998] rounded-xl"
        style={{
          top,
          left,
          width,
          height,
          border: "2px solid rgba(255,255,255,0.9)",
          boxShadow: "0 0 12px 2px rgba(255,255,255,0.25)",
        }}
      />

      {/* Bouncing cursor + label */}
      <div
        className="fixed z-[9999] pointer-events-none flex flex-col items-center gap-1.5"
        style={{
          top: top + height + 6,
          left: left + width / 2,
          transform: "translateX(-50%)",
        }}
      >
        <div className="animate-bounce text-[22px] leading-none select-none drop-shadow-lg">
          👆
        </div>
        <div className="bg-slate-900/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap shadow-xl backdrop-blur-sm">
          {label}
        </div>
      </div>
    </>
  );
}
