import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 2026,      // 👈 Change port here
    strictPort: true // 👈 Optional: prevents fallback to another port
  }
})
