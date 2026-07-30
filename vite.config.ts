import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Site is served from the root of the custom domain (https://www.bridgeloop.pl),
// so `base` stays '/' in both dev and production builds.
export default defineConfig(() => ({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      // Nowy service worker aktywuje się sam i przejmuje kartę; użytkownik po
      // ponownym wejściu ma świeżą wersję bez ręcznego czyszczenia cache.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Jedyne źródło manifestu to statyczny public/manifest.json (+ linki w
      // index.html). Plugin odpowiada tylko za wygenerowanie service workera.
      manifest: false,
      workbox: {
        // Precache POWŁOKI aplikacji: zbudowane assety + ikony. Świadomie NIE
        // cache'ujemy Supabase (auth, rozdania) — to zawsze idzie po sieci, żeby
        // nie serwować nieświeżych danych ani nie psuć logowania.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        // Zrzuty z manifestu czyta tylko przeglądarka, pokazując dialog instalacji —
        // aplikacja nigdy o nie nie prosi. W precache'u byłoby to pół megabajta
        // ściągane przy pierwszym wejściu bez żadnego pożytku dla użytkownika.
        globIgnores: ['screenshots/**'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          // Google Fonts — arkusz stylów i pliki woff2, żeby offline miał typografię.
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gfonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'gfonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Service worker działa tylko w buildzie produkcyjnym — dev (i harness
      // ?preview=table) pozostają nietknięte.
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5174 },
}))
