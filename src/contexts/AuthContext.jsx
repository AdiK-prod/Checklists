import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const _timeoutMs = Number(import.meta.env.VITE_HOUSEHOLD_FETCH_TIMEOUT_MS)
const HOUSEHOLD_FETCH_TIMEOUT_MS =
  Number.isFinite(_timeoutMs) && _timeoutMs >= 3000
    ? Math.min(_timeoutMs, 120_000)
    : 15_000

const AuthContext = createContext(null)

/** Single in-flight household fetch; all callers share one Promise. */
let fetchPromise = null
/** Increment on SIGNED_OUT / signOut so late responses do not apply stale state. */
let householdFetchInvalidation = 0

function withHouseholdTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Household lookup timed out')),
        HOUSEHOLD_FETCH_TIMEOUT_MS,
      )
    }),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [householdLoading, setHouseholdLoading] = useState(false)

  const prevUserIdRef = useRef(null)

  useEffect(() => {
    prevUserIdRef.current = user?.id ?? null
  }, [user?.id])

  const runHouseholdFetch = useCallback(async (userId) => {
    const ticket = householdFetchInvalidation
    setHouseholdLoading(true)
    try {
      const work = (async () => {
        const { data: link, error: e1 } = await supabase
          .from('household_users')
          .select('household_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (e1) return { error: e1, household: null }

        const hid = link?.household_id
        if (!hid) return { error: null, household: null }

        const { data: h, error: e2 } = await supabase
          .from('households')
          .select('id, name')
          .eq('id', hid)
          .maybeSingle()

        if (e2) return { error: e2, household: null }
        return { error: null, household: h }
      })()

      const { error, household: h } = await withHouseholdTimeout(work)

      if (ticket !== householdFetchInvalidation) return

      if (error) throw error

      setHousehold(h ?? null)
    } catch (e) {
      if (ticket !== householdFetchInvalidation) return
      console.error('fetchHousehold:', e)
      setHousehold(null)
    } finally {
      if (ticket === householdFetchInvalidation) {
        setHouseholdLoading(false)
      }
    }
  }, [])

  const fetchHousehold = useCallback((userId) => {
    if (!userId) {
      setHousehold(null)
      setHouseholdLoading(false)
      return Promise.resolve()
    }
    if (fetchPromise) return fetchPromise
    fetchPromise = runHouseholdFetch(userId)
    fetchPromise.finally(() => {
      fetchPromise = null
    })
    return fetchPromise
  }, [runHouseholdFetch])

  const fetchHouseholdRef = useRef(fetchHousehold)
  fetchHouseholdRef.current = fetchHousehold

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return

        if (error) {
          setSession(null)
          setUser(null)
          setHousehold(null)
          return
        }

        let sess = data?.session ?? null
        if (!sess) {
          try {
            const { data: refData, error: refErr } = await supabase.auth.refreshSession()
            if (cancelled) return
            if (!refErr) sess = refData?.session ?? null
          } catch {
            /* ignore */
          }
        }

        setSession(sess)
        setUser(sess?.user ?? null)
        if (sess?.user) {
          try {
            await fetchHouseholdRef.current(sess.user.id)
          } catch {
            /* errors handled inside runHouseholdFetch */
          }
        } else {
          setHousehold(null)
        }
      } catch {
        if (!cancelled) {
          setSession(null)
          setUser(null)
          setHousehold(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      if (event === 'INITIAL_SESSION') return

      if (event === 'TOKEN_REFRESHED') {
        setSession(session)
        setUser(session?.user ?? null)
        if (!session?.user) setHousehold(null)
        return
      }

      if (event === 'USER_UPDATED') {
        setSession(session)
        setUser(session?.user ?? null)
        if (!session?.user) setHousehold(null)
        return
      }

      if (event === 'SIGNED_OUT') {
        householdFetchInvalidation++
        fetchPromise = null
        setSession(null)
        setUser(null)
        setHousehold(null)
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        const priorId = prevUserIdRef.current
        setSession(session)
        setUser(session.user)
        if (session.user.id !== priorId) {
          await fetchHouseholdRef.current(session.user.id)
        }
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) setHousehold(null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
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
    householdFetchInvalidation++
    fetchPromise = null
    await supabase.auth.signOut()
  }

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
