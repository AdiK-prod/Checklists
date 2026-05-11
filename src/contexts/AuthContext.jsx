import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const HOUSEHOLD_FETCH_TIMEOUT_MS = 15_000
/** If INITIAL_SESSION never fires (e.g. older clients), fall back to getSession. */
const INIT_FALLBACK_MS = 2_500

const AuthContext = createContext(null)

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

  const fetchHousehold = useCallback(async (userId) => {
    if (!userId) {
      setHousehold(null)
      setHouseholdLoading(false)
      return
    }
    setHouseholdLoading(true)
    try {
      const { data, error } = await supabase
        .from('household_users')
        .select('household_id, households(id, name)')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) {
        console.error('fetchHousehold:', error)
        setHousehold(null)
        return
      }
      setHousehold(data?.households ?? null)
    } catch (e) {
      console.error('fetchHousehold:', e)
      setHousehold(null)
    } finally {
      setHouseholdLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrapDoneRef = { current: false }

    async function applySession(session, { raceHousehold } = { raceHousehold: false }) {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        try {
          const p = fetchHousehold(session.user.id)
          if (raceHousehold) await withHouseholdTimeout(p)
          else await p
        } catch (e) {
          console.warn(e)
        }
      } else {
        setHousehold(null)
      }
    }

    async function fallbackBootstrap() {
      if (cancelled || bootstrapDoneRef.current) return
      bootstrapDoneRef.current = true
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error) {
          console.error('getSession (fallback):', error)
          setSession(null)
          setUser(null)
          setHousehold(null)
          return
        }
        let sess = data?.session ?? null
        if (!sess) {
          try {
            const { data: refData, error: refErr } = await supabase.auth.refreshSession()
            if (!cancelled && !refErr) sess = refData?.session ?? null
          } catch (_) { /* ignore */ }
        }
        await applySession(sess, { raceHousehold: true })
      } catch (e) {
        if (!cancelled) {
          console.error('Auth fallback init:', e)
          setSession(null)
          setUser(null)
          setHousehold(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const fallbackTimer = setTimeout(fallbackBootstrap, INIT_FALLBACK_MS)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      if (event === 'INITIAL_SESSION') {
        clearTimeout(fallbackTimer)
        if (!bootstrapDoneRef.current) {
          bootstrapDoneRef.current = true
          try {
            await applySession(session ?? null, { raceHousehold: true })
          } catch (e) {
            console.error('INITIAL_SESSION:', e)
          } finally {
            if (!cancelled) setLoading(false)
          }
        } else {
          try {
            await applySession(session ?? null, { raceHousehold: false })
          } catch (e) {
            console.error('INITIAL_SESSION (late):', e)
          }
        }
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchHousehold(session.user.id)
      } else {
        setHousehold(null)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [fetchHousehold])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        /** Where the email confirmation link should send the user after they click it */
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
  }

  async function resendSignupEmail(email) {
    return supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  /** Opens Google OAuth; user returns to `redirectTo` with session in URL hash (handled by Supabase client). */
  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/`
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
