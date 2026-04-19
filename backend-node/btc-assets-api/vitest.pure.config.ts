import { defineConfig } from 'vitest/config';

/**
 * Minimal vitest config for running pure-logic tests without pulling in
 * the app container (which would require a live Redis / CKB RPC). Used
 * for standalone regression tests such as `test/env.defaults.test.ts`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.pure.test.ts', 'test/env.defaults.test.ts'],
    pool: 'forks',
  },
});
