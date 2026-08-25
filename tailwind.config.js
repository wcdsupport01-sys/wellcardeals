/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
  colors: {
    navy: {
      50: "#eef2f9",
      100: "#dbe3f1",
      300: "#7f96c4",
      500: "#173772",
      600: "#122a5c",
      700: "#0e2148",
      900: "#0B1F4D",
      950: "#071331",
    },
    brand: {
      DEFAULT: "#2563EB",
      50: "#eff6ff",
      100: "#dbeafe",
      300: "#93c5fd",
      500: "#2563EB",
      600: "#1d4ed8",
      700: "#1e40af",
    },
    accent: {
      DEFAULT: "#F97316",
      50: "#fff7ed",
      100: "#ffedd5",
      400: "#fb923c",
      500: "#F97316",
      600: "#ea580c",
    },
    surface: {
      DEFAULT: "#F8FAFC",
      muted: "#F1F5F9",
    },
  },
  fontFamily: {
    display: ["Poppins", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
    sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
  },
  borderRadius: {
    xl: "12px",
    "2xl": "16px",
  },
  boxShadow: {
  soft: "0 2px 8px rgba(11, 31, 77, 0.06)",
  card: "0 4px 20px rgba(11, 31, 77, 0.08)",
  lift: "0 12px 32px rgba(11, 31, 77, 0.14)",
  glow: "0 0 0 1px rgba(37,99,235,.08),0 8px 24px rgba(37,99,235,.12)",

  // NEW
  search: "0 20px 60px rgba(15,23,42,.12)",
  floating: "0 25px 80px rgba(2,6,23,.18)",
},
  backgroundImage: {
  "navy-gradient":
    "linear-gradient(135deg,#0B1F4D 0%,#173772 60%,#2563EB 100%)",

  "accent-gradient":
    "linear-gradient(135deg,#F97316 0%,#fb923c 100%)",

  glass:
    "linear-gradient(135deg,rgba(255,255,255,.85),rgba(255,255,255,.55))",

  // NEW
  hero:
    "linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%)",
},
  animation: {
    move: "move 12s linear infinite",
    "fade-up": "fadeUp 0.5s ease-out",
  },
  backdropBlur: {
  xs: "2px",
},
  keyframes: {
    move: {
      "0%": { transform: "translateX(0)" },
      "100%": { transform: "translateX(-120vw)" },
    },
    fadeUp: {
      "0%": { opacity: 0, transform: "translateY(12px)" },
      "100%": { opacity: 1, transform: "translateY(0)" },
    },
  },
},
  },
  plugins: [],
}