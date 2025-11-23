/** @type {import('tailwindcss').Config} */

export const PALETTE = {
  // Primary - 파란색 (Task Node, 기본 Port)
  primary: {
    color: "#60a5fa", // blue-400 (edge gradient end)
    bg: "#3b82f6", // blue-500
    border: "#2563eb", // blue-600
  },
  // Neutral - 회색 (Default Edge, Target Port)
  neutral: {
    color: "#94a3b8", // slate-400 (edge gradient end)
    bg: "#94a3b8", // slate-400
    border: "#64748b", // slate-500
  },
  // Success - 초록색 (Start Node, Success Edge)
  success: {
    color: "#4ade80", // green-400 (edge gradient end)
    bg: "#22c55e", // green-500
    border: "#16a34a", // green-600
  },
  // Danger - 빨간색 (End Node Failure, Error Edge)
  danger: {
    color: "#f87171", // red-400 (edge gradient end)
    bg: "#ef4444", // red-500
    border: "#dc2626", // red-600
  },
  // Warning - 노란색 (Decision Node, Warning Edge)
  warning: {
    color: "#facc15", // yellow-400 (edge gradient end)
    bg: "#eab308", // yellow-500
    border: "#ca8a04", // yellow-600
  },
  // Secondary - 보라색 (Service Node)
  secondary: {
    color: "#a78bfa", // purple-400 (edge gradient end)
    bg: "#8b5cf6", // purple-500
    border: "#7c3aed", // purple-600
  },
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        palette: PALETTE,
      },
    },
  },
  plugins: [],
};
