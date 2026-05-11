import { Plus, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTrips } from '../../hooks/useTrips'
import { useHousehold } from '../../hooks/useHousehold'
import { isTripPast } from '../../lib/utils'
import TripCard from '../ui/TripCard'
import { SkeletonCard } from '../ui/Skeleton'

export default function Dashboard() {
  const { household } = useAuth()
  const navigate      = useNavigate()
  const { trips, loading, error, deleteTrip, refetch } = useTrips(household?.id)
  const { members }               = useHousehold(household?.id)

  const tripList = Array.isArray(trips) ? trips : []
  const upcoming = tripList.filter(t => !isTripPast(t))
  const past = tripList
    .filter(t => isTripPast(t))
    .sort((a, b) => String(b.datesFrom || '').localeCompare(String(a.datesFrom || '')))

  async function handleDeleteTrip(trip) {
    if (!window.confirm(`Delete “${trip.name}”? This cannot be undone.`)) return
    const { ok } = await deleteTrip(trip.id)
    if (!ok) window.alert('Could not delete the trip. Check your connection and try again.')
  }

  return (
    <div className="bg-page">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="sticky top-0 bg-page z-10 px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-18 font-medium text-content-primary leading-tight">My Trips</h1>
          <p className="text-12 text-content-secondary mt-0.5">
            {loading
              ? 'Loading…'
              : `${tripList.length} trip${tripList.length !== 1 ? 's' : ''} · ${upcoming.length} upcoming${past.length ? ` · ${past.length} past` : ''}`}
          </p>
        </div>

        <div className="flex items-start gap-2 flex-shrink-0 mt-0.5">
          <button
            type="button"
            onClick={() => navigate('/settings', { state: { direction: 'forward' } })}
            aria-label="Settings"
            className="w-9 h-9 rounded-full border border-[#e0ddd8] flex items-center justify-center text-content-secondary hover:bg-[#f1efe8] transition-colors"
          >
            <Settings size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/new', { state: { direction: 'forward' } })}
            aria-label="New trip"
            className="w-9 h-9 rounded-full bg-navy flex items-center justify-center hover:bg-navy-hover transition-colors"
          >
            <Plus size={18} color="white" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="px-4 pt-1 pb-8">
        <SectionLabel>Upcoming</SectionLabel>

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <RetryError
            message="Couldn't load trips"
            onRetry={() => refetch()}
          />
        ) : upcoming.length === 0 ? (
          <p className="text-13 text-content-hint py-3">
            No upcoming trips yet — tap + to plan one.
          </p>
        ) : (
          upcoming.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              members={members}
              isPast={false}
              onClick={() => navigate(`/trips/${trip.id}`, { state: { direction: 'forward' } })}
              onDelete={() => handleDeleteTrip(trip)}
            />
          ))
        )}

        {!loading && !error && past.length > 0 && (
          <div className="mt-5">
            <SectionLabel>Past trips</SectionLabel>
            {past.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                members={members}
                isPast
                onClick={() => navigate(`/trips/${trip.id}`, { state: { direction: 'forward' } })}
                onDelete={() => handleDeleteTrip(trip)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">
      {children}
    </p>
  )
}

function RetryError({ message, onRetry }) {
  return (
    <button
      onClick={onRetry}
      className="text-13 text-content-secondary py-3"
    >
      {message} — tap to retry
    </button>
  )
}
