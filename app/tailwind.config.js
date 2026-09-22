/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* ===== 十日牌局 design tokens (design.md §2) ===== */
        abyss: "#07060B",
        ink: "#0C0A13",
        panel: "#14101C",
        elevated: "#1D1626",
        felt: "#101A16",
        gold: {
          100: "#F8E9C0",
          300: "#E3C27C",
          500: "#C6A15B",
          700: "#8A6A33",
        },
        cinnabar: {
          DEFAULT: "#D8443C",
          hi: "#F0655A",
        },
        suit: {
          spade: "#8B93F8",
          heart: "#EE6A72",
          club: "#4ECB9C",
          diamond: "#F2A93B",
        },
        tier: {
          huang: "#E8C15A",
          xuan: "#9B7FE8",
          di: "#C98A4B",
          tian: "#7FC8E8",
        },
        bone: "#F2EAD8",
        dim: "#A89F8D",
        faint: "#6E6880",
        ok: "#4ECB9C",
        danger: "#F0655A",
        info: "#8B93F8",
      },
      fontFamily: {
        serifsc: ['"Noto Serif SC"', 'serif'],
        sanssc: ['"Noto Sans SC"', 'sans-serif'],
        mashan: ['"Ma Shan Zheng"', 'cursive'],
        cinzel: ['Cinzel', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        panel: "0 8px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(248,233,192,.04)",
        card: "0 16px 48px rgba(0,0,0,.6)",
        "gold-glow": "0 0 20px rgba(227,194,124,.28)",
        "gold-glow-lg": "0 0 24px rgba(227,194,124,.25)",
      },
      transitionTimingFunction: {
        ink: "cubic-bezier(.22,1,.36,1)",
        snap: "cubic-bezier(.83,0,.17,1)",
        spring: "cubic-bezier(.34,1.56,.64,1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "breathe": {
          "0%,100%": { opacity: ".6" },
          "50%": { opacity: "1" },
        },
        "float-y": {
          "0%,100%": { transform: "translateY(-12px)" },
          "50%": { transform: "translateY(12px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "gold-sweep": {
          from: { transform: "translateX(-150%) skewX(-20deg)" },
          to: { transform: "translateX(250%) skewX(-20deg)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: ".5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.25)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        breathe: "breathe 2.4s ease-in-out infinite",
        "float-y": "float-y 7s ease-in-out infinite",
        "spin-slower": "spin-slow 120s linear infinite",
        "spin-30": "spin-slow 30s linear infinite",
        "pulse-dot": "pulse-dot 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
