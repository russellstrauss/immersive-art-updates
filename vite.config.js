import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import eslint from 'vite-plugin-eslint'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    eslint({
      cache: false,
      include: ['src/**/*.vue', 'src/**/*.js']
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    https: {
      key: readFileSync('./src/assets/ssh/jrstrauss.net+5-key.pem'),
      cert: readFileSync('./src/assets/ssh/jrstrauss.net+5.pem')
    },
    port: 8080,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'babylon-core': ['babylonjs'],
          'babylon-gui': ['babylonjs-gui'],
          'babylon-loaders': ['babylonjs-loaders']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['babylonjs', 'babylonjs-gui', 'babylonjs-loaders', 'babylonjs-serializers']
  }
})










