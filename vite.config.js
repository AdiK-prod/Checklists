import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { runSuggest } from './api/_suggestCore.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
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
