import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Site is served from the root of the custom domain (https://www.bridgeloop.pl),
// so `base` stays '/' in both dev and production builds.
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
  server: { port: 5174 },
}))
