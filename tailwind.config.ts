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
        brand: {
          50: "#f0f5ff",
          100: "#e0eaff",
          200: "#c7d7fe",
          300: "#a4bcfd",
          400: "#7c98fb",
          500: "#536bf6",
          600: "#3b49e9",
          700: "#2d35cd",
          800: "#282da5",
          900: "#252b82",
          950: "#16184e",
        },
        corporate: {
          navy: "#0f172a",
          slate: "#1e293b",
          border: "#e2e8f0",
          card: "#ffffff",
          subtle: "#f8fafc",
        },
      },
    },
  },
  plugins: [],
};

export default config;
