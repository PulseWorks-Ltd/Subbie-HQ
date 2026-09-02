/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#137fec",
        "background-light": "#f6f7f8",
        "background-dark": "#101922",
        // Marketing-site-only dark design system (2026-09 redesign) — new,
        // distinctly-named tokens so they never collide with the
        // authenticated app's own primary/background-light/background-dark
        // above. Marketing pages use these directly (never behind a
        // `dark:` prefix), so the marketing site renders this same dark
        // look regardless of a visitor's OS colour-scheme or the signed-in
        // app's own light/dark toggle state — the two are deliberately
        // decoupled. Values match public/marketing/code.html, the source
        // design reference, minus its few genuinely unused tokens.
        surface: "#051424",
        "surface-deep": "#020617",
        "surface-container": "#122131",
        "surface-card": "#1E293B",
        "surface-variant": "#273647",
        "on-surface": "#d4e4fa",
        "on-surface-variant": "#c2c6d8",
        "accent-electric": "#3B82F6",
        "accent-soft": "#b2c5ff",
        "outline-variant": "#424655",
        tertiary: "#4edea3",
        "status-warning": "#F59E0B",
        "status-error": "#EF4444",
        "primary-container": "#5b8cff"
      },
      fontFamily: {
        display: ["var(--font-display)", "Inter", "sans-serif"],
        // Marketing-site headings only — see app/layout.tsx's Hanken_Grotesk
        // next/font setup. Body copy on marketing pages reuses `display`
        // (Inter) above rather than adding a second body-font token.
        heading: ["var(--font-heading)", "Hanken Grotesk", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        gutter: "24px",
        "container-max": "1280px",
        "section-gap-sm": "64px",
        "section-gap-lg": "120px",
        "stack-md": "16px"
      }
    }
  },
  plugins: []
};
