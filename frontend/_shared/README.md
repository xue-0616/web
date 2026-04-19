# frontend/\_shared

Tiny, dependency-free modules shared across the Phase 6/7 front-ends.
Each file is self-contained so consumers can either:

- **Symlink** it into `src/lib/` (preferred on Unix dev boxes):

  ```bash
  cd frontend/solagram-wallet-oss/src/lib
  ln -s ../../../_shared/sentry.ts sentry.ts
  ```

- **Copy** it into `src/lib/` (what CI does, since GitHub Actions
  checkouts don't preserve symlinks on all runners).

Why not publish as an internal npm package? Publishing would require
private-registry infra none of the OSS projects want to take on; the
two-file footprint isn't worth it.

## Files

| File | Used by | Depends on |
| --- | --- | --- |
| `sentry.ts` | every Phase 6/7 front-end | `@sentry/browser` (optional; function no-ops without it) |

## Integration recipe (Sentry)

1. `npm i -E @sentry/browser` in the consuming project.
2. Symlink or copy `sentry.ts` into `src/lib/sentry.ts`.
3. Set `VITE_SENTRY_DSN` (Vite) or `NEXT_PUBLIC_SENTRY_DSN` (Next) in
   `.env.production`.
4. Call `initSentry({ project: "<slug>" })` once from the app entry
   (`main.tsx` for Vite, `layout.tsx` for Next).

The function is a no-op when the DSN is empty, so local dev and CI do
nothing special.
