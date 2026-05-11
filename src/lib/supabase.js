// All DB access must go through hooks / lib — never call supabase directly from components.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean)

  throw new Error(
    `Missing Supabase env: ${missing.join(', ')}. ` +
    'Add them in your host (e.g. Vercel → Project → Settings → Environment Variables), ' +
    'then redeploy. Names must be exactly VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
