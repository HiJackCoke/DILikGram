/**
 * useLongPress - Custom hook for detecting long press on touch devices
 *
 * Triggers a callback when user holds touch for a specified duration
 * Automatically cancels if touch moves beyond threshold (to distinguish from drag)
 */

import { WorkflowNode } from "@/types";
import { TouchEvent, useRef, useCallback } from "react";

interface UseLongPressOptions {
  onLongPress: (event: TouchEvent, node: WorkflowNode) => void;
  delay?: number; // Default: 500ms
  moveThreshold?: number; // Default: 10px (movement allowed before cancellation)
}

export function useLongPress({
  onLongPress,
  delay = 500,
  moveThreshold = 10,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback(
    (event: TouchEvent, node: WorkflowNode) => {
      // Store initial touch position
      const touch = event.touches?.[0];

      if (!touch) return;
      startPosRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };

      // Start timer
      timerRef.current = setTimeout(() => {
        onLongPress(event, node);
      }, delay);
    },
    [onLongPress, delay],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!startPosRef.current || !timerRef.current) return;

      const touch = event.touches[0];

      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

      // Cancel if movement exceeds threshold (distinguish from drag)
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        startPosRef.current = null;
      }
    },
    [moveThreshold],
  );

  const handleTouchEnd = useCallback(() => {
    // Clean up timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}
