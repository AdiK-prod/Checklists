import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Dashboard       from './components/screens/Dashboard'
import Wizard          from './components/screens/Wizard'
import TripPage        from './components/screens/TripPage'
import LoginScreen     from './components/screens/LoginScreen'
import Onboarding      from './components/screens/Onboarding'
import Settings        from './components/screens/Settings'
import TemplatesScreen from './components/screens/TemplatesScreen'
import JoinHousehold   from './components/screens/JoinHousehold'

function AppLoading() {
  return (
    <div className="bg-page min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-13 text-content-secondary">Loading…</div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, household, loading, householdLoading } = useAuth()
  const location = useLocation()

  if (loading || (user && householdLoading)) return <AppLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!household && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

/** Logged-in users with a household should not see onboarding. */
function OnboardingGate({ children }) {
  const { user, household, loading, householdLoading } = useAuth()
  if (loading || (user && householdLoading)) return <AppLoading />
  if (!user) return <Navigate to="/login" replace />
  if (household) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const location  = useLocation()
  const direction = location.state?.direction
  const animClass = direction === 'forward' ? 'screen-forward'
    : direction === 'back' ? 'screen-back'
    : ''

  const isLogin = location.pathname === '/login'
  const isJoin  = location.pathname === '/join'

  const frameClass =
    isLogin || isJoin
      ? 'h-[100dvh] overflow-hidden flex flex-col'
      : 'min-h-screen md:h-screen md:overflow-y-auto md:overflow-x-hidden'

  return (
    <div className="bg-page md:bg-[#ede9e3] md:h-screen md:overflow-hidden md:flex md:justify-center">
      <div
        className={
          'relative w-full max-w-[430px] bg-page font-dm-sans md:rounded-[32px] md:border md:border-[rgba(0,0,0,0.08)] ' +
          frameClass
        }
      >
        <div
          key={location.pathname + location.search}
          className={[animClass, isLogin || isJoin ? 'flex-1 min-h-0 flex flex-col' : ''].join(' ')}
        >
          <Routes>
            <Route path="/join" element={<JoinHousehold />} />
            <Route path="/login" element={<LoginScreen />} />

            <Route path="/onboarding" element={
              <OnboardingGate><Onboarding /></OnboardingGate>
            } />

            <Route path="/" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/new" element={
              <ProtectedRoute><Wizard /></ProtectedRoute>
            } />
            <Route path="/trips/:id" element={
              <ProtectedRoute><TripPage /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><Settings /></ProtectedRoute>
            } />
            <Route path="/templates" element={
              <ProtectedRoute><TemplatesScreen /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
