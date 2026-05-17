import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Gracefully handle backend being offline in dev
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('json' in res) {
              (res as any).json({ error: 'API server offline — start it with: cd server && npm run dev' })
            }
          })
        },
      },
    },
  },
})
