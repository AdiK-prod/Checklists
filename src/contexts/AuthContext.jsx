import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [household, setHousehold] = useState(null)
  const [loading, setLoading]     = useState(true)

  const fetchHousehold = useCallback(async (userId) => {
    const { data } = await supabase
      .from('household_users')
      .select('household_id, households(id, name)')
      .eq('user_id', userId)
      .maybeSingle()
    setHousehold(data?.households ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await fetchHousehold(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchHousehold(session.user.id)
        } else {
          setHousehold(null)
        }
      }
    )
    return () => subscription.unsubscribe()
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
