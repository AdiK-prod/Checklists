import { useState } from 'react'

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
          <DashboardPlaceholder navigate={navigate} />
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

// ── Placeholders — replaced screen by screen in Modules 2–4 ──────────────

function DashboardPlaceholder({ navigate }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-14 font-medium text-content-primary">Dashboard</p>
      <p className="text-12 text-content-secondary">Module 2 builds this screen.</p>
      <div className="flex gap-2">
        <button
          onClick={navigate.toWizard}
          className="px-4 py-2 bg-navy text-white rounded-button text-13 font-medium"
        >
          New trip
        </button>
        <button
          onClick={() => navigate.toTrip('trip-barcelona')}
          className="px-4 py-2 border border-input-border rounded-button text-13 text-content-primary"
        >
          Barcelona (demo)
        </button>
      </div>
    </div>
  )
}

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
