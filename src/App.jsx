import { useState } from 'react'
import Dashboard from './components/screens/Dashboard'

// Screen values: 'dashboard' | 'wizard' | 'trip'
// Module 7 replaces this state machine with react-router-dom routes.

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard')
  const [currentTripId, setCurrentTripId] = useState(null)

  const navigate = {
    toDashboard: () => {
      setCurrentTripId(null)
      setCurrentScreen('dashboard')
    },
    toWizard: () => {
      setCurrentScreen('wizard')
    },
    toTrip: (tripId) => {
      setCurrentTripId(tripId)
      setCurrentScreen('trip')
    },
  }

  return (
    <div className="min-h-screen bg-page font-dm-sans">
      {/* Mobile container — Module 6 adds the desktop frame */}
      <div className="mx-auto w-full max-w-[430px]">
        {currentScreen === 'dashboard' && (
          <Dashboard navigate={navigate} />
        )}
        {currentScreen === 'wizard' && (
          <WizardPlaceholder navigate={navigate} />
        )}
        {currentScreen === 'trip' && (
          <TripPlaceholder tripId={currentTripId} navigate={navigate} />
        )}
      </div>
    </div>
  )
}

// ── Placeholders — replaced in Modules 3 and 4 ───────────────────────────

function WizardPlaceholder({ navigate }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-14 font-medium text-content-primary">New trip wizard</p>
      <p className="text-12 text-content-secondary">Module 3 builds this screen.</p>
      <button
        onClick={navigate.toDashboard}
        className="px-4 py-2 border border-input-border rounded-button text-13 text-content-primary"
      >
        ← Back
      </button>
    </div>
  )
}

function TripPlaceholder({ tripId, navigate }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-14 font-medium text-content-primary">Trip page</p>
      <p className="text-12 text-content-secondary">
        Trip ID: <span className="text-content-primary">{tripId}</span>
      </p>
      <p className="text-12 text-content-secondary">Module 4 builds this screen.</p>
      <button
        onClick={navigate.toDashboard}
        className="px-4 py-2 border border-input-border rounded-button text-13 text-content-primary"
      >
        ← All trips
      </button>
    </div>
  )
}
