import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  build: { sourcemap: false },
  worker: { format: 'es' },
  test: { environment: 'node' }
})
