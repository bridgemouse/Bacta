// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'client',
  build: { outDir: '../dist/client' },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
