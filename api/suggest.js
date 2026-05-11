import { runSuggest } from './_suggestCore.js'

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' })
    }
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return sendJson(res, 503, { error: 'AI not configured (ANTHROPIC_API_KEY)' })
  }

  try {
    const out = await runSuggest(body, key)
    return sendJson(res, 200, out)
  } catch (err) {
    return sendJson(res, 500, { error: err?.message || 'Suggestion failed' })
  }
}
