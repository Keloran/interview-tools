import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'

// Not UTC on purpose: local-vs-UTC date bugs only show up east/west of UTC (and the users are in the UK).
// Set here so the test workers inherit it; changing TZ inside a test file doesn't reach them.
// Targeted regressions can override the worker timezone without changing the UK default.
process.env.TZ = process.env.INTERVIEW_TEST_TIMEZONE ?? 'Europe/London'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setupTests.ts'],
    css: false,
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
})
