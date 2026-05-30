import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
