import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  // Independent review archives contain their own HTML/package trees. They are
  // evidence, not app entries; scanning them can optimize a second React copy.
  optimizeDeps: { entries: ['index.html'] },
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'] },
  build: { sourcemap: false },
  worker: { format: 'es' },
  test: { environment: 'node', exclude: [...configDefaults.exclude, 'work/**'] }
})
