import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { runSuggest } from './api/_suggestCore.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'pwa-192.png', 'pwa-512.png'],
        manifest: {
          name: 'PackSmart',
          short_name: 'PackSmart',
          description: 'Family trip packing checklists shared with your household.',
          theme_color: '#0f766e',
          background_color: '#f5f3ee',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        name: 'dev-api-suggest',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = req.url?.split('?')[0]
            if (path !== '/api/suggest' || req.method !== 'POST') return next()

            const raw = await new Promise((resolve, reject) => {
              const chunks = []
              req.on('data', (c) => chunks.push(c))
              req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
              req.on('error', reject)
            })

            let body
            try {
              body = JSON.parse(raw || '{}')
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid JSON' }))
              return
            }

            const key = env.ANTHROPIC_API_KEY
            if (!key) {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in .env' }))
              return
            }

            try {
              const out = await runSuggest(body, key)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(out))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e?.message || 'Suggestion failed' }))
            }
          })
        },
      },
    ],
  }
})
