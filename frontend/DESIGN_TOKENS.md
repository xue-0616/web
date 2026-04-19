# UniPass Design Tokens

Single source of truth for brand design across the 5 Phase 6 frontends.
Not a published npm package (yet) — each project **inlines** an identical
copy under `src/design/tokens.css` + `src/design/tokens.ts`. If any value
changes, sync all 5 files in the same PR.

## Rationale

- No monorepo publishing infra yet → inline is simpler than `workspace:*`.
- Tiny surface (<50 tokens) → duplication cost is low.
- Every token is a CSS variable, so dark mode = flip a single
  `prefers-color-scheme` media query. Components don't branch on mode.

## Token groups

| Group | Tokens |
|---|---|
| Color (neutrals) | `--bg`, `--surface`, `--border`, `--fg`, `--muted` |
| Color (brand) | `--brand`, `--brand-hover`, `--brand-fg` |
| Color (semantic) | `--danger`, `--warn`, `--success` |
| Typography | `--font-sans`, `--text-xs … --text-3xl` |
| Spacing | `--space-1 … --space-12` (4px unit) |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg` |
| Shadow | `--shadow-sm`, `--shadow-md` |

Also shipped as a TypeScript object (`tokens.ts`) for inline styles when CSS
modules/global CSS don't compose easily (e.g. Next.js RSC + React email).

## Per-project location

```
frontend/<project>-oss/src/design/
├── tokens.css
└── tokens.ts
```

Imported once from each project's root layout (or `main.tsx`).
