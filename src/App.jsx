import { useState, useCallback } from 'react'
import { INITIAL_TRIPS } from './data/trips'
import { HOUSEHOLD } from './data/household'
import Dashboard from './components/screens/Dashboard'
import Wizard from './components/screens/Wizard'
import TripPage from './components/screens/TripPage'

// Screen values: 'dashboard' | 'wizard' | 'trip'
// Module 7 replaces this state machine with react-router-dom routes.

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard')
  const [currentTripId, setCurrentTripId] = useState(null)
  const [direction, setDirection] = useState(null)   // null | 'forward' | 'back'
  const [trips, setTrips] = useState(INITIAL_TRIPS)  // mutable demo state

  // ── Navigation ──────────────────────────────────────────────
  const navigate = {
    toDashboard: () => { setDirection('back');    setCurrentTripId(null); setCurrentScreen('dashboard') },
    toWizard:    () => { setDirection('forward'); setCurrentScreen('wizard') },
    toTrip: (id) => { setDirection('forward'); setCurrentTripId(id); setCurrentScreen('trip') },
  }

  const handleGenerate = () => navigate.toTrip('trip-barcelona')

  // ── Checklist mutations ──────────────────────────────────────
  const onToggleItem = useCallback((tripId, memberId, itemId) => {
    setTrips(prev => prev.map(trip => {
      if (trip.id !== tripId) return trip
      return {
        ...trip,
        checklists: {
          ...trip.checklists,
          [memberId]: (trip.checklists[memberId] || []).map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        },
      }
    }))
  }, [])

  const onAddItem = useCallback((tripId, memberId, label) => {
    const newId = `item-${Date.now()}`
    setTrips(prev => prev.map(trip => {
      if (trip.id !== tripId) return trip
      return {
        ...trip,
        checklists: {
          ...trip.checklists,
          [memberId]: [
            ...(trip.checklists[memberId] || []),
            { id: newId, label, category: 'Other', checked: false, isAiSuggested: false, isManuallyAdded: true, savedToTemplate: false, sortOrder: Date.now() },
          ],
        },
      }
    }))
    return newId
  }, [])

  const onSaveToTemplate = useCallback((tripId, memberId, itemId) => {
    setTrips(prev => prev.map(trip => {
      if (trip.id !== tripId) return trip
      return {
        ...trip,
        checklists: {
          ...trip.checklists,
          [memberId]: (trip.checklists[memberId] || []).map(item =>
            item.id === itemId ? { ...item, savedToTemplate: true } : item
          ),
        },
      }
    }))
  }, [])

  const currentTrip = trips.find(t => t.id === currentTripId)

  const animClass = direction === 'forward' ? 'screen-forward'
    : direction === 'back' ? 'screen-back'
    : ''

  return (
    // ── Module 6: desktop frame ──────────────────────────────
    // Mobile:  full-width, standard scroll, page bg #faf8f4
    // Desktop: centred 430px container, h-screen, border+radius, outer bg #ede9e3
    <div className="bg-page md:bg-[#ede9e3] md:min-h-screen md:flex md:justify-center">
      <div className="relative w-full max-w-[430px] bg-page font-dm-sans min-h-screen
                      md:h-screen md:overflow-y-auto md:overflow-x-hidden
                      md:rounded-[32px] md:border md:border-[rgba(0,0,0,0.08)]">

        <div key={currentScreen} className={animClass}>
          {currentScreen === 'dashboard' && (
            <Dashboard trips={trips} members={HOUSEHOLD.members} navigate={navigate} />
          )}
          {currentScreen === 'wizard' && (
            <Wizard navigate={navigate} onGenerate={handleGenerate} />
          )}
          {currentScreen === 'trip' && currentTrip && (
            <TripPage
              trip={currentTrip}
              members={HOUSEHOLD.members}
              onToggleItem={onToggleItem}
              onAddItem={onAddItem}
              onSaveToTemplate={onSaveToTemplate}
              navigate={navigate}
            />
          )}
        </div>

      </div>
    </div>
  )
}
