// vite.config.js
// Vite is the build tool — it compiles your React code into plain HTML/JS
// Think of it like a translator: React code → browser-readable code

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
