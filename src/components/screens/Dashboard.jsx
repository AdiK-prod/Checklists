import { Plus } from 'lucide-react'
import TripCard from '../ui/TripCard'

// DEMO SCAFFOLDING — trips/members come from App.jsx state (seeded from INITIAL_TRIPS/HOUSEHOLD).
// Module 7 replaces prop drilling with useTrips / useHousehold hooks.

export default function Dashboard({ trips, members, navigate }) {

  const upcoming = trips.filter(t => t.status === 'upcoming')
  const archived = trips.filter(t => t.status === 'completed')

  return (
    <div className="min-h-screen bg-page">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="sticky top-0 bg-page z-10 px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-18 font-medium text-content-primary leading-tight">
            My Trips
          </h1>
          <p className="text-12 text-content-secondary mt-0.5">
            {trips.length} trip{trips.length !== 1 ? 's' : ''} · {upcoming.length} upcoming
          </p>
        </div>

        {/* Plus button — circular, navy */}
        <button
          onClick={navigate.toWizard}
          aria-label="New trip"
          className="w-9 h-9 rounded-full bg-navy flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-navy-hover transition-colors"
        >
          <Plus size={18} color="white" strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="px-4 pt-1 pb-8">

        {/* Upcoming section */}
        <SectionLabel>Upcoming</SectionLabel>

        {upcoming.length === 0 ? (
          <p className="text-13 text-content-hint py-3">
            No upcoming trips yet — tap + to plan one.
          </p>
        ) : (
          upcoming.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              members={members}
              onClick={() => navigate.toTrip(trip.id)}
            />
          ))
        )}

        {/* Archive section — only rendered when trips exist */}
        {archived.length > 0 && (
          <div className="mt-5">
            <SectionLabel>Archive</SectionLabel>
            {archived.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                members={members}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Internal: section label ───────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">
      {children}
    </p>
  )
}
