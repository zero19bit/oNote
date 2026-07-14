/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // DevNotes brand palette — deep slate + cyan accent
        bg: {
          base: "#0b0f17",        // app background
          surface: "#111827",     // cards
          elevated: "#1a2233",    // elevated cards / modals
          inset: "#0f1622",       // inputs / code blocks
        },
        border: {
          DEFAULT: "#1f2937",
          strong: "#2d3a4f",
          focus: "#22d3ee",
        },
        fg: {
          DEFAULT: "#e5e7eb",
          muted: "#9ca3af",
          subtle: "#6b7280",
          inverse: "#0b0f17",
        },
        accent: {
          DEFAULT: "#22d3ee",     // cyan-400
          hover: "#67e8f9",
          muted: "#155e75",
        },
        brand: {
          purple: "#a78bfa",
          pink: "#f472b6",
          amber: "#fbbf24",
          green: "#34d399",
          red: "#f87171",
        },
        // Skill level colors
        level: {
          1: "#ef4444",
          2: "#f97316",
          3: "#eab308",
          4: "#84cc16",
          5: "#22c55e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34, 211, 238, 0.4), 0 0 24px -4px rgba(34, 211, 238, 0.4)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px -8px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(34,211,238,0.08), transparent 60%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
