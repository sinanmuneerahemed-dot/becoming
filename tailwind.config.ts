import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: "#0a0a1a",
          light: "#1a0a2e",
          dark: "#050510",
        },
        "neon-cyan": {
          DEFAULT: "#00f5ff",
          dim: "#00b8c4",
        },
        "neon-magenta": {
          DEFAULT: "#ff00ff",
          dim: "#c400c4",
        },
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.05)",
          border: "rgba(255, 255, 255, 0.1)",
        },
      },
      backgroundImage: {
        "gradient-midnight":
          "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)",
        "gradient-neon":
          "linear-gradient(90deg, #00f5ff 0%, #ff00ff 50%, #00f5ff 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "grid-drift": "gridDrift 20s linear infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
      },
      keyframes: {
        gridDrift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 40px" },
        },
        shimmer: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
