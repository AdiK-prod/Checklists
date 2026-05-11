import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { authDebug } from '../lib/authDebugLog'

const HOUSEHOLD_FETCH_TIMEOUT_MS = 15_000

const AuthContext = createContext(null)

function shortId(id) {
  if (!id || typeof id !== 'string') return null
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function withHouseholdTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Household lookup timed out')),
        HOUSEHOLD_FETCH_TIMEOUT_MS
      )
    }),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading]     = useState(true)
  /** True while resolving household_users for the signed-in user (including after SIGNED_IN). */
  const [householdLoading, setHouseholdLoading] = useState(false)

  const fetchHousehold = useCallback(async (userId, source = 'unknown') => {
    const t0 = performance.now()
    authDebug('fetchHousehold:start', { source, userId: shortId(userId) })

    if (!userId) {
      setHousehold(null)
      setHouseholdLoading(false)
      authDebug('fetchHousehold:skip (no userId)', { source, ms: Math.round(performance.now() - t0) })
      return
    }
    setHouseholdLoading(true)
    try {
      const { data, error } = await supabase
        .from('household_users')
        .select('household_id, households(id, name)')
        .eq('user_id', userId)
        .maybeSingle()

      const ms = Math.round(performance.now() - t0)

      if (error) {
        authDebug('fetchHousehold:supabase error', {
          source,
          ms,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
        console.error('fetchHousehold:', error)
        setHousehold(null)
        return
      }

      const h = data?.households ?? null
      authDebug('fetchHousehold:ok', {
        source,
        ms,
        householdId: h?.id ? shortId(h.id) : null,
        householdName: h?.name ?? null,
        rawHasHouseholdRow: !!data?.household_id,
      })
      setHousehold(h)
    } catch (e) {
      authDebug('fetchHousehold:throw', {
        source,
        ms: Math.round(performance.now() - t0),
        message: e?.message ?? String(e),
      })
      console.error('fetchHousehold:', e)
      setHousehold(null)
    } finally {
      setHouseholdLoading(false)
      authDebug('fetchHousehold:finally householdLoading=false', {
        source,
        totalMs: Math.round(performance.now() - t0),
      })
    }
  }, [])

  const fetchHouseholdRef = useRef(fetchHousehold)
  fetchHouseholdRef.current = fetchHousehold

  useEffect(() => {
    let cancelled = false

    /**
     * Single ordered boot: session first, then household — avoids racing two “sources of truth”
     * (e.g. INITIAL_SESSION vs getSession) that each flip loading / user / household at different times.
     */
    async function bootstrap() {
      authDebug('bootstrap:start', { cancelled: false })
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) {
          authDebug('bootstrap:aborted after getSession (unmounted)', {})
          return
        }

        if (error) {
          authDebug('bootstrap:getSession error', {
            message: error.message,
            name: error.name,
          })
          console.error('getSession:', error)
          setSession(null)
          setUser(null)
          setHousehold(null)
          return
        }

        const sess0 = data?.session ?? null
        authDebug('bootstrap:getSession result', {
          hasSession: !!sess0,
          userId: shortId(sess0?.user?.id),
          expiresAt: sess0?.expires_at ?? null,
        })

        let sess = sess0
        if (!sess) {
          authDebug('bootstrap:refreshSession attempt (no session from getSession)', {})
          try {
            const { data: refData, error: refErr } = await supabase.auth.refreshSession()
            if (cancelled) {
              authDebug('bootstrap:aborted after refreshSession', {})
              return
            }
            if (refErr) {
              authDebug('bootstrap:refreshSession error', {
                message: refErr.message,
                name: refErr.name,
              })
            } else {
              sess = refData?.session ?? null
              authDebug('bootstrap:refreshSession result', {
                hasSession: !!sess,
                userId: shortId(sess?.user?.id),
              })
            }
          } catch (re) {
            authDebug('bootstrap:refreshSession throw', { message: re?.message ?? String(re) })
          }
        }

        setSession(sess)
        setUser(sess?.user ?? null)
        if (sess?.user) {
          try {
            authDebug('bootstrap:await household (with timeout)', {
              userId: shortId(sess.user.id),
              timeoutMs: HOUSEHOLD_FETCH_TIMEOUT_MS,
            })
            await withHouseholdTimeout(fetchHouseholdRef.current(sess.user.id, 'bootstrap'))
          } catch (e) {
            authDebug('bootstrap:household phase failed', {
              message: e?.message ?? String(e),
            })
            console.warn(e)
          }
        } else {
          authDebug('bootstrap:no user on session — clearing household', {})
          setHousehold(null)
        }
      } catch (e) {
        if (!cancelled) {
          authDebug('bootstrap:throw', { message: e?.message ?? String(e) })
          console.error('Auth bootstrap:', e)
          setSession(null)
          setUser(null)
          setHousehold(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          authDebug('bootstrap:done', {
            note: 'setLoading(false); user/session/household state applies on next React commit',
          })
        }
      }
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'INITIAL_SESSION') {
        authDebug('onAuthStateChange:SKIP INITIAL_SESSION (handled by bootstrap)', {
          hasSession: !!session,
          userId: shortId(session?.user?.id),
        })
        return
      }

      authDebug('onAuthStateChange', {
        event,
        hasSession: !!session,
        userId: shortId(session?.user?.id),
      })

      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchHouseholdRef.current(session.user.id, `listener:${event}`)
      } else {
        setHousehold(null)
        authDebug('onAuthStateChange:cleared household (no session user)', { event })
      }
    })

    return () => {
      authDebug('AuthProvider effect cleanup (unsubscribe)', {})
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    authDebug('signInWithPassword:calling', { emailLength: email?.length ?? 0 })
    const out = await supabase.auth.signInWithPassword({ email, password })
    authDebug('signInWithPassword:result', {
      ok: !out.error,
      errorMessage: out.error?.message ?? null,
      hasSession: !!out.data?.session,
      userId: shortId(out.data?.user?.id ?? out.data?.session?.user?.id),
    })
    return out
  }

  async function signUp(email, password) {
    const out = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    authDebug('signUp:result', {
      ok: !out.error,
      errorMessage: out.error?.message ?? null,
      hasUser: !!out.data?.user,
      hasSession: !!out.data?.session,
    })
    return out
  }

  async function resendSignupEmail(email) {
    return supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
  }

  async function signOut() {
    authDebug('signOut:calling', {})
    await supabase.auth.signOut()
    authDebug('signOut:done', {})
  }

  /** Opens Google OAuth; user returns to `redirectTo` with session in URL hash (handled by Supabase client). */
  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/`
    authDebug('signInWithOAuth:google', { redirectTo })
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <AuthContext.Provider value={{
      user, session, household, loading, householdLoading,
      signIn, signUp, signOut, signInWithGoogle, resendSignupEmail,
      refreshHousehold: fetchHousehold,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
