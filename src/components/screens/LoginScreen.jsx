import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plane, Mail } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginScreen() {
  const { user, household, signIn, signUp, signInWithGoogle, resendSignupEmail } = useAuth()

  const [tab, setTab]                         = useState('signin')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [oauthLoading, setOauthLoading]       = useState(false)
  const [fieldErrors, setFieldErrors]         = useState({})
  const [authError, setAuthError]             = useState('')
  /** Set when sign-up succeeded but email must be confirmed (no session yet). */
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState(null)
  const [resendStatus, setResendStatus]       = useState(null)
  const [resendLoading, setResendLoading]     = useState(false)

  if (user) return <Navigate to={household ? '/' : '/onboarding'} replace />

  function validate() {
    const errs = {}
    if (!email) errs.email = 'Required'
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email'
    if (!password) errs.password = 'Required'
    else if (password.length < 6) errs.password = 'Min 6 chars'
    if (tab === 'signup' && password !== confirmPassword) {
      errs.confirmPassword = 'No match'
    }
    return errs
  }

  function mapSignInError(message) {
    const m = (message || '').toLowerCase()
    if (m.includes('email not confirmed') || m.includes('not confirmed')) {
      return 'Confirm your email first — we sent you a link when you signed up. Check your inbox and spam folder.'
    }
    return message
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')
    setResendStatus(null)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    if (tab === 'signin') {
      const { error } = await signIn(email, password)
      setLoading(false)
      if (error) setAuthError(mapSignInError(error.message))
      return
    }

    const { data, error } = await signUp(email, password)
    setLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }

    // Email confirmation required → Supabase returns user but no session
    if (data?.user && !data?.session) {
      setPendingVerifyEmail(email.trim())
      setPassword('')
      setConfirmPassword('')
      return
    }

    // Immediate session (confirm email disabled) → AuthContext updates → Navigate runs
  }

  function switchTab(t) {
    setTab(t)
    setFieldErrors({})
    setAuthError('')
    setPendingVerifyEmail(null)
    setResendStatus(null)
  }

  async function handleGoogle() {
    setAuthError('')
    setOauthLoading(true)
    const { error } = await signInWithGoogle()
    setOauthLoading(false)
    if (error) setAuthError(error.message)
  }

  async function handleResend() {
    if (!pendingVerifyEmail) return
    setResendLoading(true)
    setResendStatus(null)
    const { error } = await resendSignupEmail(pendingVerifyEmail)
    setResendLoading(false)
    if (error) setResendStatus({ ok: false, text: error.message })
    else setResendStatus({ ok: true, text: 'Another email is on its way.' })
  }

  if (pendingVerifyEmail) {
    return (
      <div className="flex-1 min-h-0 flex flex-col justify-center items-center px-4 py-3 overflow-y-auto">
        <div
          className="w-full max-w-[320px] bg-white rounded-card p-4 shrink-0"
          style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
        >
          <div className="flex justify-center mb-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#E6F1FB' }}
            >
              <Mail size={22} style={{ color: '#185FA5' }} aria-hidden />
            </div>
          </div>
          <h2 className="text-15 font-medium text-content-primary text-center mb-2">
            Check your email
          </h2>
          <p className="text-12 text-content-secondary text-center leading-snug mb-1">
            We sent a confirmation link to
          </p>
          <p className="text-13 font-medium text-content-primary text-center break-all mb-3">
            {pendingVerifyEmail}
          </p>
          <p className="text-11 text-content-hint text-center leading-snug mb-4">
            Open the link in that message to finish creating your account. If you don&apos;t see it, check spam or promotions.
          </p>

          {resendStatus && (
            <p
              className="text-11 text-center rounded-input px-2 py-1.5 mb-3"
              style={{
                color: resendStatus.ok ? '#0F6E56' : '#c03434',
                backgroundColor: resendStatus.ok ? '#E1F5EE' : '#fff0f0',
              }}
            >
              {resendStatus.text}
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="w-full rounded-button py-2 text-13 font-medium text-white bg-navy hover:bg-navy-hover transition-colors mb-2 disabled:opacity-60"
          >
            {resendLoading ? 'Sending…' : 'Resend confirmation email'}
          </button>
          <button
            type="button"
            onClick={() => { setPendingVerifyEmail(null); setResendStatus(null) }}
            className="w-full py-2 text-12 text-content-secondary"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-center items-center px-4 py-3 overflow-hidden">

      {/* Header — compact */}
      <div className="flex flex-col items-center shrink-0 mb-2">
        <div
          className="w-11 h-11 rounded-[14px] bg-navy flex items-center justify-center mb-1.5"
          style={{ boxShadow: '0 2px 12px rgba(61,100,148,0.28)' }}
        >
          <Plane size={22} color="white" />
        </div>
        <h1 className="text-[17px] font-medium text-content-primary leading-tight">PackSmart</h1>
        <p className="text-11 text-content-secondary text-center mt-0.5 leading-snug max-w-[220px]">
          Family packing lists
        </p>
      </div>

      {/* Card — fits sign-in or sign-up without page scroll */}
      <div
        className="w-full max-w-[320px] bg-white rounded-card p-3 shrink-0"
        style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
      >
        <div className="flex bg-surface rounded-button p-0.5 mb-2.5">
          {[['signin', 'Sign in'], ['signup', 'Sign up']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={[
                'flex-1 py-1.5 rounded-[9px] text-12 font-medium transition-all',
                tab === key ? 'bg-white text-content-primary' : 'text-content-secondary',
              ].join(' ')}
              style={tab === key ? { boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || oauthLoading}
          className="w-full flex items-center justify-center gap-2 rounded-button py-2 text-13 font-medium text-content-primary bg-white border border-[#e0ddd8] hover:bg-[#faf8f4] transition-colors mb-2.5 disabled:opacity-60"
        >
          <GoogleMark size={18} />
          {oauthLoading ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-2 mb-2.5">
          <span className="flex-1 h-px bg-[#e8e4de]" />
          <span className="text-10 uppercase tracking-wider text-content-hint">or email</span>
          <span className="flex-1 h-px bg-[#e8e4de]" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-2">
          <Field label="Email" error={fieldErrors.email}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              className={inputCls(!!fieldErrors.email)}
            />
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'Min 6 chars' : '••••••••'}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              className={inputCls(!!fieldErrors.password)}
            />
          </Field>

          {tab === 'signup' && (
            <Field label="Confirm" error={fieldErrors.confirmPassword}>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                className={inputCls(!!fieldErrors.confirmPassword)}
              />
            </Field>
          )}

          {authError && (
            <p className="text-11 leading-snug rounded-input px-2 py-1.5 bg-[#fff0f0]" style={{ color: '#c03434' }}>
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || oauthLoading}
            className="w-full bg-navy hover:bg-navy-hover text-white rounded-button py-2.5 text-14 font-medium transition-colors disabled:opacity-60"
          >
            {loading
              ? (tab === 'signin' ? 'Signing in…' : 'Creating…')
              : (tab === 'signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-11 font-medium text-content-secondary mb-0.5">{label}</label>
      {children}
      {error && (
        <p className="text-10 mt-0.5" style={{ color: '#c03434' }}>{error}</p>
      )}
    </div>
  )
}

function inputCls(hasError) {
  return [
    'w-full text-13 text-content-primary rounded-input px-2.5 py-1.5 bg-white focus:outline-none transition-colors',
    hasError ? 'border border-[#e05454]' : 'border border-[#e0ddd8] focus:border-navy',
  ].join(' ')
}

/** Minimal Google “G” for the button (brand colours). */
function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
