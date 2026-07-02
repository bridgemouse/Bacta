// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'client',
  // emptyOutDir: outDir is outside root (../dist/client), so Vite refuses to
  // clean it by default — every build's hashed assets pile up forever otherwise.
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
