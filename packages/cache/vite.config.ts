import { defineConfig } from 'vite'
import { resolve } from 'path'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const lib =
  process.env.VITE_LIB === 'sw'
    ? 'src/integrations/browser/sw/sw.ts'
    : 'src/index.ts'

const filename = process.env.VITE_LIB === 'sw' ? 'sw.js' : 'index.js'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    emptyOutDir: false,

    sourcemap: true,

    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'castmill-cache',
      fileName: (format) => filename,
      formats: ['es'],
    },

    rollupOptions: {
      plugins: [nodeResolve()],
      input: {
        lib: resolve(__dirname, lib),
      },
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      // external: ["vue", "gsap", "lodash", "rxjs"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        dir: 'dist/',
        format: 'es',
      },
    },
  },
})
