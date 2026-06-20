import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is set to the repo name for the production build so assets resolve on
// GitHub Pages (https://redds212.github.io/bridge-trainer/). Dev stays at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/bridge-trainer/' : '/',
  plugins: [react()],
  server: { port: 5174 },
}))
