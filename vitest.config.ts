import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./apps/studio/src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['{apps,packages,mocks}/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'e2e/**'],
    coverage: { provider: 'v8', include: ['packages/*/src/**', 'apps/studio/src/**'] },
  },
})
