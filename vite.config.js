import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo-mark.png'],
      manifest: {
        name: 'Sonqollay — Control de Ingeniería',
        short_name: 'Sonqollay',
        description:
          'Plataforma de gestión de proyectos de ingeniería, control documental y empaquetamiento de trabajo (AWP/BIM).',
        lang: 'es',
        dir: 'ltr',
        theme_color: '#F77000',
        background_color: '#05080c',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cachea el app shell para uso offline. Sube el límite por los chunks
        // grandes (xlsx, BimViewer/three) que se precachean.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        // NO precachear index.html: se sirve siempre desde la red (NetworkFirst)
        // para evitar quedar con un HTML viejo que apunte a chunks viejos
        // (causa de "addEventListener is not a function" tras un deploy).
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // /api/* siempre va a la red — nunca se cachea. Sin esto el SW puede
            // devolver index.html cacheado para rutas API y romper el visor 3D.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // HTML / navegaciones: siempre la última versión si hay red; el
            // caché solo se usa como respaldo offline.
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fuentes de Google: cache-first con expiración larga.
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // IMPORTANTE: el service worker NO debe interceptar el CDN de Autodesk.
          // Cachear esas respuestas como opacas (status 0) rompe la carga de
          // `lmvworker.min.js`, que el navegador pide como Worker y NO acepta
          // respuestas opacas ("an opaque response was used for a request whose
          // type is not no-cors" → net::ERR_FAILED → el visor cae en
          // "t.addEventListener is not a function"). El SDK requiere red y token
          // en vivo, así que no tiene sentido cachearlo: se deja pasar directo.
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Los chunks grandes (xlsx, BimViewer/three) se cargan de forma diferida.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa React de la app para mejor cacheo entre despliegues.
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
