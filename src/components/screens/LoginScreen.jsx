import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginScreen() {
  const { user, household, signIn, signUp } = useAuth()

  const [tab, setTab]                       = useState('signin')
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]               = useState(false)
  const [fieldErrors, setFieldErrors]       = useState({})
  const [authError, setAuthError]           = useState('')

  if (user) return <Navigate to={household ? '/' : '/onboarding'} replace />

  function validate() {
    const errs = {}
    if (!email) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'At least 6 characters'
    if (tab === 'signup' && password !== confirmPassword) {
      errs.confirmPassword = "Passwords don't match"
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    const { error } = tab === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)

    if (error) {
      setAuthError(error.message)
    }
    // Auth state change triggers AuthContext → ProtectedRoute redirects automatically
  }

  function switchTab(t) {
    setTab(t)
    setFieldErrors({})
    setAuthError('')
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-5 py-10">

      {/* App icon */}
      <div
        className="w-16 h-16 rounded-[18px] bg-navy flex items-center justify-center mb-5"
        style={{ boxShadow: '0 4px 20px rgba(61,100,148,0.35)' }}
      >
        <Plane size={28} color="white" />
      </div>

      <h1 className="text-[22px] font-medium text-content-primary mb-1">PackSmart</h1>
      <p className="text-13 text-content-secondary mb-8 text-center">
        Your family's packing organiser
      </p>

      {/* Card */}
      <div
        className="w-full max-w-[360px] bg-white rounded-card p-5"
        style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
      >
        {/* Tab switcher */}
        <div className="flex bg-surface rounded-button p-1 mb-5">
          {[['signin', 'Sign in'], ['signup', 'Sign up']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={[
                'flex-1 py-2 rounded-[10px] text-13 font-medium transition-all',
                tab === key
                  ? 'bg-white text-content-primary'
                  : 'text-content-secondary',
              ].join(' ')}
              style={tab === key ? { boxShadow: '0 1px 3px rgba(0,0,0,0.10)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
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
              placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              className={inputCls(!!fieldErrors.password)}
            />
          </Field>

          {tab === 'signup' && (
            <Field label="Confirm password" error={fieldErrors.confirmPassword}>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={inputCls(!!fieldErrors.confirmPassword)}
              />
            </Field>
          )}

          {authError && (
            <p className="text-12 rounded-input px-3 py-2 bg-[#fff0f0]" style={{ color: '#c03434' }}>
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy hover:bg-navy-hover text-white rounded-button py-[13px] text-15 font-medium transition-colors mt-1 disabled:opacity-60"
          >
            {loading
              ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
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
      <label className="block text-12 font-medium text-content-secondary mb-1">{label}</label>
      {children}
      {error && (
        <p className="text-11 mt-1" style={{ color: '#c03434' }}>{error}</p>
      )}
    </div>
  )
}

function inputCls(hasError) {
  return [
    'w-full text-14 text-content-primary rounded-input px-3 py-[10px] bg-white focus:outline-none transition-colors',
    hasError
      ? 'border border-[#e05454]'
      : 'border border-[#e0ddd8] focus:border-navy',
  ].join(' ')
}
