
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Tajawal', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        arabic: ['Tajawal', 'sans-serif'],
        english: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 6px -1px rgb(0 0 0 / 0.04)",
        brand: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        "brand-lg": "0 2px 8px -2px rgb(0 0 0 / 0.06)",
      },
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
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
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
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-in-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(30px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "scale-bounce": {
          "0%": {
            transform: "scale(0)",
            opacity: "0",
          },
          "60%": {
            transform: "scale(1.1)",
            opacity: "1",
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1",
          },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        "slide-up-sticky": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "cart-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        "attention-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(248, 113, 113, 0.35)" },
          "50%": { boxShadow: "0 0 0 6px rgba(248, 113, 113, 0.12)" },
        },
        "attention-enter": {
          "0%": {
            opacity: "0.92",
            boxShadow: "0 0 0 0 hsl(0 84% 60% / 0.35), 0 8px 24px -8px hsl(0 84% 60% / 0.22)",
            backgroundColor: "hsl(0 84% 60% / 0.11)",
          },
          "40%": {
            boxShadow: "0 0 0 6px hsl(0 84% 60% / 0.14), 0 12px 28px -10px hsl(0 84% 60% / 0.2)",
            backgroundColor: "hsl(0 84% 60% / 0.08)",
          },
          "100%": {
            opacity: "1",
            boxShadow: "0 0 0 2px hsl(0 84% 60% / 0.22), 0 8px 24px -8px hsl(0 84% 60% / 0.16)",
            backgroundColor: "hsl(0 84% 60% / 0.07)",
          },
        },
        "attention-strip-glow": {
          "0%, 100%": {
            borderBottomColor: "hsl(0 84% 60% / 0.65)",
            boxShadow: "0 8px 24px -10px hsl(0 84% 60% / 0.35)",
          },
          "50%": {
            borderBottomColor: "hsl(0 84% 60% / 0.3)",
            boxShadow: "0 2px 10px -8px hsl(0 84% 60% / 0.1)",
          },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "slide-up-sticky": "slide-up-sticky 0.3s ease-out forwards",
        "scale-bounce": "scale-bounce 0.5s ease-out forwards",
        "scale-in": "scale-bounce 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.2s ease-out forwards",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "cart-pop": "cart-pop 0.35s ease-out",
        "attention-glow": "attention-glow 2s ease-in-out 3",
        "attention-enter": "attention-enter 1.1s ease-out forwards",
        "attention-bar-glow": "attention-bar-glow 2.2s ease-in-out infinite",
        "attention-strip-glow": "attention-strip-glow 2s ease-in-out 2",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
