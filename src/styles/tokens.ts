/**
 * Outlaw design tokens — reference copy for use in TS/JS (charts, inline
 * styles, etc). The CSS custom properties in `globals.css` are the source of
 * truth for styling; keep these hex values in sync with that file.
 */
export const colors = {
  paper: "#E8DCC4",
  paperDark: "#D8C6A2",
  ink: "#2B1D12",
  inkFaded: "#4A3620",
  inkMuted: "#6B5432",
  blood: "#8B1A1A",
  brass: "#9C7A2E",
  lawful: "#3E5C2E",
  borderDark: "#B09A72",
} as const;

export const fonts = {
  poster: "var(--font-poster)",
  ledger: "var(--font-ledger)",
  flavor: "var(--font-flavor)",
} as const;
