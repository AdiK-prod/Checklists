import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const HOUSEHOLD_FETCH_TIMEOUT_MS = 15_000

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading]     = useState(true)

  const fetchHousehold = useCallback(async (userId) => {
    if (!userId) {
      setHousehold(null)
      return
    }
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
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    /** Must always end with loading false — never leave the app on a blank screen. */
    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (cancelled) return

        if (error) {
          console.error('getSession:', error)
          setSession(null)
          setUser(null)
          setHousehold(null)
          return
        }

        const session = data?.session ?? null
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          try {
            await Promise.race([
              fetchHousehold(session.user.id),
              new Promise((_, reject) => {
                setTimeout(
                  () => reject(new Error('Household lookup timed out')),
                  HOUSEHOLD_FETCH_TIMEOUT_MS
                )
              }),
            ])
          } catch (e) {
            console.warn(e)
          }
        } else {
          setHousehold(null)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Auth init:', e)
          setSession(null)
          setUser(null)
          setHousehold(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchHousehold(session.user.id)
        } else {
          setHousehold(null)
        }
      }
    )
    return () => {
      cancelled = true
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
      user, session, household, loading,
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
