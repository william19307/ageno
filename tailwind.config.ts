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
        // WorkOS 设计系统颜色（直接引用 CSS 变量）
        "wos-base":     "var(--bg-base)",
        "wos-surface":  "var(--bg-surface)",
        "wos-elevated": "var(--bg-elevated)",
        "wos-overlay":  "var(--bg-overlay)",
        "wos-accent":   "var(--accent)",
        "wos-success":  "var(--success)",
        "wos-warning":  "var(--warning)",
        "wos-danger":   "var(--danger)",
        // shadcn/ui 变量映射
        background:     "var(--bg-base)",
        foreground:     "var(--text-primary)",
        primary: {
          DEFAULT:      "var(--accent)",
          foreground:   "#ffffff",
        },
        secondary: {
          DEFAULT:      "var(--bg-elevated)",
          foreground:   "var(--text-secondary)",
        },
        muted: {
          DEFAULT:      "var(--bg-elevated)",
          foreground:   "var(--text-tertiary)",
        },
        destructive: {
          DEFAULT:      "var(--danger)",
          foreground:   "#ffffff",
        },
        border:         "var(--border-default)",
        input:          "var(--border-default)",
        ring:           "var(--accent)",
        card: {
          DEFAULT:      "var(--bg-surface)",
          foreground:   "var(--text-primary)",
        },
        popover: {
          DEFAULT:      "var(--bg-overlay)",
          foreground:   "var(--text-primary)",
        },
      },
      fontFamily: {
        sans:  ["Geist", "Inter", "system-ui", "sans-serif"],
        mono:  ["Geist Mono", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        xs:   ["11px", { lineHeight: "1.5" }],
        sm:   ["12px", { lineHeight: "1.5" }],
        base: ["13px", { lineHeight: "1.5" }],
        md:   ["14px", { lineHeight: "1.5" }],
        lg:   ["16px", { lineHeight: "1.5" }],
        xl:   ["20px", { lineHeight: "1.3" }],
        "2xl": ["24px", { lineHeight: "1.3" }],
      },
      spacing: {
        "1":  "4px",
        "2":  "8px",
        "3":  "12px",
        "4":  "16px",
        "5":  "20px",
        "6":  "24px",
        "8":  "32px",
        "10": "40px",
        "12": "48px",
      },
      borderRadius: {
        sm:   "4px",
        md:   "6px",
        lg:   "8px",
        xl:   "12px",
        full: "999px",
        DEFAULT: "6px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
