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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
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
          {
            // SDK del visor de Autodesk (CDN): stale-while-revalidate.
            urlPattern: ({ url }) => url.href.includes('developer.api.autodesk.com/modelderivative'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'aps-viewer-sdk',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
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
