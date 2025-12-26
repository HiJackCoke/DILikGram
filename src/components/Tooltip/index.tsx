import type { ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="group relative inline-block">
      {children}

      {/* Tooltip Content */}
      <div
        className={`
          absolute ${positionStyles[position]}
          invisible opacity-0 group-hover:visible group-hover:opacity-100
          transition-all duration-200 pointer-events-none z-50
          w-max max-w-xs
        `}
      >
        <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg px-3 py-2">
          {content}
        </div>
        {/* Arrow */}
        <div
          className={`
            absolute w-2 h-2 bg-gray-900 rotate-45
            ${position === "top" ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" : ""}
            ${position === "bottom" ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" : ""}
            ${position === "left" ? "right-0 top-1/2 -translate-y-1/2 translate-x-1/2" : ""}
            ${position === "right" ? "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2" : ""}
          `}
        />
      </div>
    </div>
  );
}
