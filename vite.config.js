import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: 'app.html'
    }
  },
  server: {
    port: 5173,
    open: "app.html"
  },
  optimizeDeps: {
    rollupOptions: undefined
  }
})
