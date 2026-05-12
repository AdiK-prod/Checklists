/**
 * Warms Supabase with a tiny read. Route stays deployed; the Vercel Cron schedule is off for now.
 *
 * To re-enable scheduled runs, merge into vercel.json next to "rewrites":
 *   "crons": [{ "path": "/api/keepalive", "schedule": "*/5 * * * *" }]
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

export default async function handler(req, res) {
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'Supabase URL or service key not configured' }))
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { error } = await supabase.from('households').select('id').limit(1)
    if (error) throw error
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }))
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: e.message }))
  }
}
