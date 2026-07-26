import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves the app from /registracijos-bylos/; local dev,
  // tests and the packed single-file build keep the root base
  base: process.env.GH_PAGES ? '/registracijos-bylos/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
