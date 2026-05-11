import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Dashboard    from './components/screens/Dashboard'
import Wizard       from './components/screens/Wizard'
import TripPage     from './components/screens/TripPage'
import LoginScreen  from './components/screens/LoginScreen'

// ── Loading splash shown while session is being restored ──────
function AppLoading() {
  return (
    <div className="bg-page min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-13 text-content-secondary">Loading…</div>
    </div>
  )
}

// ── Redirect unauthenticated users to /login ──────────────────
function ProtectedRoute({ children }) {
  const { user, household, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AppLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  // New users without a household go to onboarding (Module 8)
  if (!household && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

// ── All routes + animated frame ───────────────────────────────
function AppRoutes() {
  const location  = useLocation()
  const direction = location.state?.direction
  const animClass = direction === 'forward' ? 'screen-forward'
    : direction === 'back' ? 'screen-back'
    : ''

  return (
    <div className="bg-page md:bg-[#ede9e3] md:h-screen md:overflow-hidden md:flex md:justify-center">
      <div className="relative w-full max-w-[430px] bg-page font-dm-sans
                      md:h-screen md:overflow-y-auto md:overflow-x-hidden
                      md:rounded-[32px] md:border md:border-[rgba(0,0,0,0.08)]">
        <div key={location.pathname} className={animClass}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginScreen />} />

            {/* Protected */}
            <Route path="/" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/new" element={
              <ProtectedRoute><Wizard /></ProtectedRoute>
            } />
            <Route path="/trips/:id" element={
              <ProtectedRoute><TripPage /></ProtectedRoute>
            } />

            {/* Placeholder routes for upcoming modules */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-page flex items-center justify-center px-4">
                  <p className="text-14 text-content-secondary">Onboarding — Module 8</p>
                </div>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-page flex items-center justify-center px-4">
                  <p className="text-14 text-content-secondary">Settings — Module 11</p>
                </div>
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
