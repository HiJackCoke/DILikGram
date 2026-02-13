import { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import DrawerView from "./View";
import type { DrawerProps } from "./types";
import { useBrowserEnv } from "@/hooks/useBrowserEnv";
import useKeyPress from "@/hooks/useKeyPress";

export default function Drawer({
  portal = true,
  selector = "#drawer-root",
  show,
  children,

  position = "right",
  width = "384px",
  height = "50vh",
  zIndex = 1000,

  mask = true,
  maskClosable = true,

  keyboard = true,

  title,
  footer,

  className,
  bodyStyle,

  onClose,
}: DrawerProps) {
  // Portal target resolution
  const element = useBrowserEnv(
    ({ document }) => document.querySelector(selector),
    null,
  );

  const [animating, setAnimating] = useState(false);

  const state = useMemo(() => {
    if (show) return "active";
    return animating ? "inactive" : "hidden";
  }, [show, animating]);

  useKeyPress(
    "Escape",
    () => {
      if (show) {
        onClose();
      }
    },
    { enabled: keyboard && show },
  );

  const handleBackdropClick = () => {
    if (maskClosable) {
      onClose();
    }
  };

  const handleOnAnimationStart = () => {
    setAnimating(true);
  };

  const handleOnAnimationEnd = () => {
    if (show) return;
    setAnimating(false);
  };

  const drawerView = (
    <div
      className="h-full relative"
      onAnimationStart={handleOnAnimationStart}
      onAnimationEnd={handleOnAnimationEnd}
    >
      <DrawerView
        portal={portal}
        state={state}
        position={position}
        width={width}
        height={height}
        mask={mask}
        maskClosable={maskClosable}
        zIndex={zIndex}
        title={title}
        footer={footer}
        className={className}
        bodyStyle={bodyStyle}
        onClose={onClose}
        onBackdropClick={handleBackdropClick}
      >
        {children}
      </DrawerView>
    </div>
  );

  if (!show && !animating) return null;

  if (element && portal) {
    return ReactDOM.createPortal(drawerView, element);
  }

  return drawerView;
}
