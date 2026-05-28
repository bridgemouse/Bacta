// vitest.client.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/client/setup.ts'],
    include: ['tests/client/**/*.test.{ts,tsx}'],
  },
})
