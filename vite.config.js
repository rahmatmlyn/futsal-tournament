import { defineConfig } from 'vite'
import { default as react } from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/futsal-tournament/', // sesuaikan dengan nama repo kamu
})
