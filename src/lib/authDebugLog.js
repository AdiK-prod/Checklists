/**
 * Auth diagnostics — filter DevTools console: PackSmart:Auth
 *
 * - Local (vite dev): logs ON by default. Set VITE_AUTH_DEBUG=false to silence.
 * - Production (Vercel): set VITE_AUTH_DEBUG=true, redeploy, reproduce, copy console lines.
 */
const AUTH_DEBUG =
  import.meta.env.VITE_AUTH_DEBUG === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_AUTH_DEBUG !== 'false')

function ts() {
  return new Date().toISOString()
}

export function authDebug(phase, data = {}) {
  if (!AUTH_DEBUG) return
  try {
    console.log(`[PackSmart:Auth ${ts()}] ${phase}`, { ...data })
  } catch {
    console.log('[PackSmart:Auth]', phase, data)
  }
}

export function authDebugEnabled() {
  return AUTH_DEBUG
}
