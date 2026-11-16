import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// "base: './'" faz o site funcionar em qualquer endereço, inclusive em
// https://thiagotcg59.github.io/ifc-energy/ (GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Em desenvolvimento, /api é repassado ao backend local.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testes/preparar.ts'],
    restoreMocks: true,
  },
})
