import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Selected explicitly by the npm test:unit/test:watch scripts so unit tests
// never load the Cloudflare app build plugins from vite.config.ts.
//
// Two reasons it exists:
//   1. vite.config.ts is built for the Cloudflare Worker / rolldown-vite
//      toolchain (@cloudflare/vite-plugin, generouted, vite-plugin-checker).
//      Vitest cannot load those plugins, and they are irrelevant to unit tests.
//   2. Vitest's default `include` would sweep up the Playwright specs in
//      tests/*.spec.ts and fail. Scoping to src keeps the runners separate:
//      unit tests here, Playwright via `npm test` / tests/playwright.config.ts.
//
// Unit tests live next to the source they cover (src/**/*.{test,spec}.ts[x]).
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  // An unmistakable unit-test sentinel keeps static-route imports testable
  // before registration. Production builds still require the server-minted id.
  define: { __DEEPSPACE_APP_ID__: JSON.stringify('unit-only-never-deployed') },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  test: {
    // Unit tests only; tests/*.spec.ts are Playwright suites run separately.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
  },
})
