import { useAuth } from '../../contexts/AuthContext'
import { Plane, Loader } from 'lucide-react'

/** Until Module 8 ships, show why the user landed here and how to exit. */
export default function OnboardingPlaceholder() {
  const { signOut, user, household, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-3 px-5">
        <Loader className="animate-spin text-navy" size={28} />
        <p className="text-13 text-content-secondary">Loading your account…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center px-5 pt-12 pb-8">
      <div
        className="w-14 h-14 rounded-[18px] bg-navy flex items-center justify-center mb-4"
        style={{ boxShadow: '0 4px 20px rgba(61,100,148,0.25)' }}
      >
        <Plane size={28} color="white" />
      </div>

      <h1 className="text-18 font-medium text-content-primary text-center mb-2">
        You&apos;re signed in
      </h1>

      <p className="text-13 text-content-secondary text-center leading-relaxed max-w-[300px] mb-6">
        Next step is to set up your household — name it and add who travels with you.
        The full onboarding flow is almost here; for now this screen is a placeholder after login.
      </p>

      {user?.email && (
        <p className="text-11 text-content-hint text-center mb-6 break-all max-w-[320px]">
          Signed in as <span className="text-content-secondary">{user.email}</span>
        </p>
      )}

      {!household && (
        <p className="text-12 text-amber-dark bg-amber-light/80 rounded-card px-4 py-3 max-w-[320px] text-center mb-8" style={{ border: '0.5px solid #e8d8b0' }}>
          If you expected to confirm your email first: check your inbox for a message from Supabase, then open the link before signing in again.
        </p>
      )}

      <button
        type="button"
        onClick={() => signOut()}
        className="text-13 font-medium text-content-secondary px-4 py-2 rounded-button hover:bg-[#eeeae4] transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
