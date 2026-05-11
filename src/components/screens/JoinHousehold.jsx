import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function JoinHousehold() {
  const [searchParams] = useSearchParams()
  const token            = searchParams.get('token')?.trim() || ''
  const { user, household, loading, refreshHousehold } = useAuth()
  const navigate         = useNavigate()
  const [busy, setBusy]  = useState(false)
  const [msg, setMsg]    = useState('')

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <p className="text-13 text-content-secondary">Loading…</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center px-5 gap-3">
        <p className="text-14 text-content-secondary text-center">This invite link is missing a token.</p>
        <button type="button" onClick={() => navigate('/login')} className="text-13" style={{ color: '#2d6fb5' }}>Sign in</button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center px-5 gap-4 text-center">
        <p className="text-16 font-medium text-content-primary">Join a household</p>
        <p className="text-13 text-content-secondary max-w-[300px]">
          Sign in or create an account to accept this invite.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login', { state: { from: `/join?token=${encodeURIComponent(token)}` } })}
          className="w-full max-w-[280px] bg-navy text-white rounded-button py-3 text-15 font-medium"
        >
          Continue to sign in
        </button>
      </div>
    )
  }

  if (household) {
    return <Navigate to="/" replace />
  }

  async function accept() {
    setMsg('')
    setBusy(true)
    const { error } = await supabase.rpc('accept_household_invite', { p_token: token })
    setBusy(false)
    if (error) {
      setMsg(error.message || 'Could not accept invite')
      return
    }
    await refreshHousehold(user.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-5 gap-4 text-center">
      <p className="text-16 font-medium text-content-primary">Join your household</p>
      <p className="text-13 text-content-secondary max-w-[300px]">
        Tap below to link your account to the shared PackSmart household.
      </p>
      {msg && (
        <p className="text-12 max-w-[300px]" style={{ color: '#c03434' }}>{msg}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={accept}
        className="w-full max-w-[280px] bg-navy text-white rounded-button py-3 text-15 font-medium disabled:opacity-60"
      >
        {busy ? 'Joining…' : 'Accept invite'}
      </button>
    </div>
  )
}
