/** @type {import('tailwindcss').Config} */

export const PALETTE = {
  // Primary - 파란색 (Task Node, 기본 Port)
  primary: {
    color: "#60a5fa", // blue-400 (edge gradient end)
    border: "#3b82f6", // blue-500
    bg: "#2563eb", // blue-600
    hover: "#93c5fd",
    active: "#1d4ed8",
  },
  // Neutral - 회색 (Default Edge, Target Port)
  neutral: {
    color: "#94a3b8", // slate-400 (edge gradient end)
    border: "#64748b", // slate-500
    bg: "#475569", // slate-600
    hover: "#cbd5e1",
    active: "#475569",
  },
  // Success - 초록색 (Start Node, Success Edge)
  success: {
    color: "#4ade80", // green-400 (edge gradient end)
    border: "#22c55e", // green-500
    bg: "#16a34a", // green-600
    hover: "#86efac",
    active: "#15803d",
  },
  // Danger - 빨간색 (End Node Failure, Error Edge)
  danger: {
    color: "#f87171", // red-400 (edge gradient end)
    border: "#ef4444", // red-500
    bg: "#dc2626", // red-600
    hover: "#fca5a5",
    active: "#b91c1c",
  },
  // Warning - 노란색 (Decision Node, Warning Edge)
  warning: {
    color: "#facc15", // yellow-400 (edge gradient end)
    border: "#eab308", // yellow-500
    bg: "#ca8a04", // yellow-600
    hover: "#fde047",
    active: "#a16207",
  },
  // Secondary - 보라색 (Service Node)
  secondary: {
    color: "#a78bfa", // purple-400 (edge gradient end)
    border: "#8b5cf6", // purple-500
    bg: "#7c3aed", // purple-600
    hover: "#c4b5fd",
    active: "#6d28d9",
  },
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Includes both /src/pages-vite-backup and /src/app
  ],
  theme: {
    extend: {
      colors: {
        palette: PALETTE,
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15), transparent 50%)",
      },
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.3s ease-out",
        gradient: "gradient 8s linear infinite",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
