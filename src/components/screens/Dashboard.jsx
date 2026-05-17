import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTrips } from '../../hooks/useTrips'
import { useHousehold } from '../../hooks/useHousehold'
import { useTemplates } from '../../hooks/useTemplates'
import { useEnsureTemplatesSeeded } from '../../hooks/useEnsureTemplatesSeeded'
import { isTripPast } from '../../lib/utils'
import TripCard from '../ui/TripCard'
import { SkeletonCard } from '../ui/Skeleton'
import { refreshWeatherForUpcomingTrips } from '../../lib/weatherService'
import EditTripSheet from '../ui/EditTripSheet'
import FeedbackSheet from '../ui/FeedbackSheet'
import ActionMenu from '../ui/ActionMenu'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const { household, user } = useAuth()
  const navigate      = useNavigate()
  const { trips, loading, error, deleteTrip, refetch } = useTrips(household?.id)
  const { members, loading: membersLoading } = useHousehold(household?.id)
  const { templates, loading: templatesLoading, refetch: refetchTemplates } = useTemplates(household?.id)
  useEnsureTemplatesSeeded(
    household?.id,
    members,
    membersLoading,
    templates,
    templatesLoading,
    refetchTemplates,
  )

  const [editingTrip, setEditingTrip]     = useState(null)
  const [localTrips,  setLocalTrips]      = useState(null)
  const [feedbackOpen, setFeedbackOpen]   = useState(false)
  const [toastMsg, setToastMsg]           = useState(null)
  const toastTimerRef                     = useRef(null)
  const [userMember, setUserMember]       = useState(null)

  const showToast = useCallback(msg => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMsg(msg)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2000)
  }, [])

  // Resolve auth user → household member for avatar colour
  useEffect(() => {
    if (!household?.id || !user?.id) return
    supabase
      .from('household_members')
      .select('id, name, avatar_colour')
      .eq('household_id', household.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setUserMember(data ?? null))
  }, [household?.id, user?.id])

  const avatarColour = userMember?.avatar_colour ?? '#3d6494'
  const avatarInitials = (() => {
    if (userMember?.name) return userMember.name.slice(0, 2).toUpperCase()
    const email = user?.email ?? ''
    return email.slice(0, 2).toUpperCase()
  })()

  const tripList = localTrips ?? (Array.isArray(trips) ? trips : [])

  // Keep localTrips in sync when fresh data arrives from the hook
  useEffect(() => {
    if (!loading) setLocalTrips(Array.isArray(trips) ? trips : [])
  }, [trips, loading])

  useEffect(() => {
    if (!loading && tripList.length) {
      refreshWeatherForUpcomingTrips(tripList).catch(() => {})
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = tripList.filter(t => !isTripPast(t))
  const past = tripList
    .filter(t => isTripPast(t))
    .sort((a, b) => String(b.datesFrom || '').localeCompare(String(a.datesFrom || '')))

  async function handleDeleteTrip(trip) {
    if (!window.confirm(`Remove "${trip.name}" and all its checklists?`)) return
    const { ok } = await deleteTrip(trip.id)
    if (!ok) window.alert('Could not delete the trip. Check your connection and try again.')
  }

  function handleTripSaved(updated) {
    setLocalTrips(prev => (prev ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t))
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
          {/* Avatar user menu */}
          <ActionMenu
            renderTrigger={() => (
              <div
                aria-label="User menu"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-13"
                style={{ backgroundColor: avatarColour }}
              >
                {avatarInitials}
              </div>
            )}
            items={[
              { label: 'Settings', onClick: () => navigate('/settings', { state: { direction: 'forward' } }) },
              { label: 'Give feedback', onClick: () => setFeedbackOpen(true) },
            ]}
          />
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
              onEdit={() => setEditingTrip(trip)}
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
                onEdit={() => setEditingTrip(trip)}
                onDelete={() => handleDeleteTrip(trip)}
              />
            ))}
          </div>
        )}
      </div>

      <EditTripSheet
        open={editingTrip !== null}
        trip={editingTrip}
        onClose={() => setEditingTrip(null)}
        onSaved={handleTripSaved}
      />

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        userId={user?.id}
        householdId={household?.id}
        onSuccess={(msg) => showToast(msg)}
      />

      {toastMsg && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#1a1a1a', color: '#fff', fontSize: 13,
            padding: '8px 16px', borderRadius: 8, zIndex: 9999,
            pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {toastMsg}
        </div>
      )}
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
