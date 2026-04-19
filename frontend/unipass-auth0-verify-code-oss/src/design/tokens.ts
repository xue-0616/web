/**
 * UniPass shared design tokens — TypeScript mirror of tokens.css.
 * See frontend/DESIGN_TOKENS.md.
 *
 * Use this when inline styles are easier than CSS variables, e.g. inside
 * server components that render email templates, or when interpolating
 * into third-party component libraries that want plain strings.
 */

export const COLORS = {
  bg: "#f8fafc",
  surface: "#ffffff",
  border: "#e5e7eb",
  fg: "#0f172a",
  muted: "#64748b",
  brand: "#6d28d9",
  brandHover: "#5b21b6",
  brandFg: "#ffffff",
  danger: "#dc2626",
  warn: "#d97706",
  success: "#16a34a",
  ring: "#8b5cf6",
} as const;

export const SPACE = {
  s1: "0.25rem",
  s2: "0.5rem",
  s3: "0.75rem",
  s4: "1rem",
  s5: "1.25rem",
  s6: "1.5rem",
  s8: "2rem",
  s10: "2.5rem",
  s12: "3rem",
} as const;

export const TEXT = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  _2xl: "1.5rem",
  _3xl: "2rem",
} as const;

export const RADIUS = { sm: "0.25rem", md: "0.5rem", lg: "1rem" } as const;
export const SHADOW = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.04)",
  md: "0 4px 12px rgba(0, 0, 0, 0.08)",
} as const;

/**
 * Versioned so regression tests (or downstream consumers) can detect a
 * palette bump. Increment when any colour changes.
 */
export const TOKENS_VERSION = 1 as const;
