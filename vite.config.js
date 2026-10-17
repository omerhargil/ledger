import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative paths, so it works at username.github.io or username.github.io/ledger/
  plugins: [react()],
})
