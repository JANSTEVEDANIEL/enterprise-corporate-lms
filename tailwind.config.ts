import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#090D16",
          50: "#0e1422",
          100: "#131C31",
          card: "#0F172A",
          elevated: "#162038",
          border: "#1E293B",
          highlight: "#2A3854",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        accent: {
          cyan: "#06b6d4",
          cyanDark: "#0891b2",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
        },
        corporate: {
          navy: "#0f172a",
          slate: "#1e293b",
          border: "#1e293b",
          card: "#0f172a",
          subtle: "#090d16",
        },
      },
      boxShadow: {
        "glow-indigo": "0 0 24px -4px rgba(99, 102, 241, 0.25)",
        "glow-cyan": "0 0 24px -4px rgba(6, 182, 212, 0.25)",
        "glass-elevated": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      letterSpacing: {
        tightest: "-0.035em",
      },
    },
  },
  plugins: [],
};

export default config;
