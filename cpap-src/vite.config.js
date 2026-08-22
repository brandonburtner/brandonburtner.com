import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// App is served from https://brandonburtner.com/cpap/
export default defineConfig({
  base: '/cpap/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
})
