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
        paper: "var(--paper)",
        "paper-dark": "var(--paper-dark)",
        ink: "var(--ink)",
        "ink-faded": "var(--ink-faded)",
        "ink-muted": "var(--ink-muted)",
        blood: "var(--blood)",
        brass: "var(--brass)",
        lawful: "var(--lawful)",
        "border-dark": "var(--border-dark)",
      },
      fontFamily: {
        poster: ["var(--font-poster)"],
        ledger: ["var(--font-ledger)"],
        flavor: ["var(--font-flavor)"],
      },
    },
  },
  plugins: [],
};
export default config;
