import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Confidence scale: Red → Yellow → Green
        confidence: {
          low: "#ef4444",      // red-500
          medium: "#eab308",   // yellow-500
          high: "#22c55e",     // green-500
        },
        // Edge type colors
        edge: {
          influences: "#3b82f6",   // blue-500
          contradicts: "#ef4444",  // red-500
          supports: "#22c55e",     // green-500
          supersedes: "#f97316",   // orange-500
          refines: "#8b5cf6",      // violet-500
        },
        // Fork style colors
        fork: {
          conservative: "#64748b", // slate-500
          aggressive: "#ef4444",   // red-500
          balanced: "#3b82f6",     // blue-500
          contrarian: "#8b5cf6",   // violet-500
        },
        // Brand colors
        brand: {
          warm: "#C4654A",    // terracotta - primary brand
          cool: "#7BA3BE",    // slate blue - secondary brand
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "typing": "typing 1s steps(20, end)",
      },
      keyframes: {
        typing: {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
