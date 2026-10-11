/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Forest & Sand Design System (Student Portal)
        forest: {
          DEFAULT: "#1B4332",
          dark: "#143326",
          light: "#255A44",
        },
        natural: {
          DEFAULT: "#40916C",
          hover: "#347959",
          light: "#EAF4EE",
        },
        sand: {
          DEFAULT: "#F5F1E8",
          dark: "#D8CDBB",
          border: "#D6D3C8",
          hover: "#E9E4D8",
          card: "#FFFFFF",
        },
        student: {
          text: "#1F2937",
          muted: "#64748B",
          success: "#15803D",
          warning: "#B45309",
          error: "#B91C1C",
        },
        // RecruitAI Brand System
        navy: {
          DEFAULT: "#111F33",
          50: "#1A2B42",
          100: "#17273C",
          800: "#142337",
          900: "#111F33",
          950: "#0C1727",
        },
        brand: {
          navy: "#111F33",
          blue: "#1976D2",
          gray: "#F5F7FA",
          border: "#E2E8F0",
          slate: "#64748B",
        },
        page: {
          DEFAULT: "#F5F7FA",
        },
        surface: {
          DEFAULT: "#FFFFFF",
        },
        // Professional Blue as Primary Accent
        primary: {
          50: "#E3F2FD",
          100: "#BBDEFB",
          200: "#90CAF9",
          300: "#64B5F6",
          400: "#42A5F5",
          500: "#2196F3",
          600: "#1976D2",
          700: "#1565C0",
          800: "#0D47A1",
          900: "#0A387E",
        },
        // Retain existing accent mapped to Professional Blue for backward compatibility
        accent: {
          50: "#E3F2FD",
          100: "#BBDEFB",
          200: "#90CAF9",
          300: "#64B5F6",
          400: "#42A5F5",
          500: "#2196F3",
          600: "#1976D2",
          700: "#1565C0",
          800: "#0D47A1",
          900: "#0A387E",
        },
        // Exact Semantic Colors
        success: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
        },
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
        info: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#1976D2",
        },
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem", // 8px
        lg: "0.625rem", // 10px
        xl: "0.75rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
        card: "0 1px 3px 0 rgb(17 31 51 / 0.05), 0 2px 6px -1px rgb(17 31 51 / 0.03)",
        popover: "0 4px 16px -4px rgb(17 31 51 / 0.12), 0 2px 6px -2px rgb(17 31 51 / 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [],
};