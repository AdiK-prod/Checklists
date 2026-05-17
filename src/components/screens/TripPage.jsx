import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Plane,
  Car,
  Moon,
  ChevronDown,
  GripVertical,
  Check,
  BookmarkPlus,
  Sun,
  Cloud,
  CloudSun,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  X,
} from 'lucide-react'
import { useDirection } from '../../contexts/DirectionContext'
import { flipIcon } from '../../lib/dirUtils'
import { getCachedWeather } from '../../lib/weatherService'
import { deleteTrip } from '../../lib/tripService'
import { exportChecklistPDF } from '../../lib/exportChecklistPDF'
import Avatar from '../ui/Avatar'
import { Skeleton, SkeletonPersonCard } from '../ui/Skeleton'
import { formatTripDates, computeNights } from '../../lib/utils'
import { getSectionIconMeta } from '../../lib/sectionIcons'
import SectionCard from '../ui/SectionCard'
import ActionMenu from '../ui/ActionMenu'
import EditTripSheet from '../ui/EditTripSheet'
import { useTripDetail } from '../../hooks/useTripDetail'

function iconFromTripType(tripType = '') {
  const lower = String(tripType).toLowerCase()
  if (lower.includes('flight') || lower.includes('abroad') || lower.includes('fly')) return Plane
  if (lower.includes('day') || lower.includes('drive') || lower.includes('local')) return Car
  return Moon
}

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function memberForPersonSection(section) {
  if (section.member) return section.member
  return {
    id: section.id,
    name: section.name,
    role: 'parent',
    age: null,
    initials: initialsFromName(section.name),
    avatarColour: { bg: '#f1efe8', text: '#6b6b6b' },
  }
}

function sectionItemTotals(section) {
  let total = 0
  let checked = 0
  for (const sub of section.subcategories || []) {
    for (const it of sub.items || []) {
      total++
      if (it.checked) checked++
    }
  }
  return { total, checked }
}

function tripProgressTotals(sections) {
  let total = 0
  let checked = 0
  for (const sec of sections || []) {
    const t = sectionItemTotals(sec)
    total += t.total
    checked += t.checked
  }
  return { total, checked }
}

function TrackLabel({ children }) {
  return (
    <p
      className="text-track-label font-medium uppercase mb-2 mt-1"
      style={{ color: '#6b6b6b', letterSpacing: '0.05em' }}
    >
      {children}
    </p>
  )
}

export default function TripPage() {
  const { id: tripId } = useParams()
  const navigate = useNavigate()
  const {
    trip,
    loading,
    error,
    toggleItem,
    quickAddItem,
    addChecklistCategory,
    removeChecklistItem,
    saveToTemplate,
    reorderItems,
    moveChecklistItem,
    rebuildChecklist,
    addStarterChecklist,
    addSection,
    updateSection,
    removeSection,
    renameChecklistSubcategory,
    removeSubcategory,
    renameChecklistItem,
  } = useTripDetail(tripId)
  const { dir } = useDirection()
  const BackArrow = flipIcon(ArrowLeft, dir)

  const [weatherOpen, setWeatherOpen] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [forecastData, setForecastData] = useState(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [localTrip, setLocalTrip] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback(msg => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2000)
  }, [])

  useEffect(() => {
    if (!tripId) return
    const cached = getCachedWeather(tripId)
    if (cached) setForecastData(cached)
  }, [tripId])

  const isInitialMount = useRef(true)
  const [animatedProgress, setAnimatedProgress] = useState(0)

  const { total: progTotal, checked: progChecked } = useMemo(
    () => tripProgressTotals(trip?.sections),
    [trip],
  )
  const totalProgress =
    progTotal === 0 ? null : Math.round((progChecked / progTotal) * 100)

  useEffect(() => {
    if (!trip) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      const t = setTimeout(
        () => setAnimatedProgress(totalProgress == null ? 0 : totalProgress),
        200,
      )
      return () => clearTimeout(t)
    }
    setAnimatedProgress(totalProgress == null ? 0 : totalProgress)
  }, [totalProgress, trip])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    event => {
      const { active, over } = event
      if (!over || active.id === over.id || !trip) return
      moveChecklistItem(active.id, over.id)
    },
    [trip, moveChecklistItem],
  )

  if (loading) {
    return (
      <div className="bg-page">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <button
            onClick={() => navigate('/', { state: { direction: 'back' } })}
            className="flex items-center gap-1 text-13"
            style={{ color: '#2d6fb5' }}
          >
            <BackArrow size={16} /> All trips
          </button>
        </div>
        <div className="px-4 pb-8">
          <Skeleton className="h-[140px] mb-3" />
          <SkeletonPersonCard />
          <SkeletonPersonCard />
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="bg-page min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-14 text-content-secondary text-center">Couldn&apos;t load this trip.</p>
        <button
          onClick={() => navigate('/', { state: { direction: 'back' } })}
          className="text-13 font-medium"
          style={{ color: '#2d6fb5' }}
        >
          ← Back to trips
        </button>
      </div>
    )
  }

  const displayTrip = localTrip ?? trip

  const HeroIcon = iconFromTripType(displayTrip.tripType)
  const dates = formatTripDates(displayTrip.datesFrom, displayTrip.datesTo)
  const nights = computeNights(displayTrip.datesFrom, displayTrip.datesTo)
  const membersList = Array.isArray(trip.members) ? trip.members : []
  const travellerIds = Array.isArray(trip.travellers) ? trip.travellers : []
  const travellers = membersList.filter(m => travellerIds.includes(m.id))

  const travellersDesc = (() => {
    const parents = membersList.filter(m => m.role === 'parent')
    const kids = membersList.filter(m => m.role === 'kid')
    if (membersList.length === 0) return ''
    if (kids.length === 0) return `${parents.length} adult${parents.length !== 1 ? 's' : ''}`
    if (parents.length === 0) return `${kids.length} kid${kids.length !== 1 ? 's' : ''}`
    return `${parents.length} adult${parents.length !== 1 ? 's' : ''} · ${kids.length} kid${kids.length !== 1 ? 's' : ''}`
  })()

  const sectionsSorted = [...(trip.sections || [])].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  )
  const sharedSections = sectionsSorted.filter(s => s.sectionType === 'shared')
  const personSections = sectionsSorted.filter(s => s.sectionType === 'person')

  async function handleRebuildChecklist() {
    setRecovering(true)
    try {
      await rebuildChecklist()
    } catch (e) {
      console.error(e)
      window.alert(e?.message || 'Could not rebuild checklist.')
    } finally {
      setRecovering(false)
    }
  }

  async function handleStarterChecklist() {
    setRecovering(true)
    try {
      await addStarterChecklist()
    } catch (e) {
      console.error(e)
      window.alert(e?.message || 'Could not create starter checklist.')
    } finally {
      setRecovering(false)
    }
  }

  async function handleDeleteTrip() {
    if (!window.confirm('Remove this trip and all its checklists?')) return
    try {
      await deleteTrip(tripId)
      navigate('/', { state: { direction: 'back' } })
    } catch (e) {
      window.alert(e?.message || 'Could not delete trip.')
    }
  }

  return (
    <div className="bg-page">
      <div className="px-4 pt-4 pb-3">
        <button
          onClick={() => navigate('/', { state: { direction: 'back' } })}
          className="flex items-center gap-1 text-13"
          style={{ color: '#2d6fb5' }}
        >
          <BackArrow size={16} />
          All trips
        </button>
      </div>

      <div className="px-4 pb-8">
        <div className="bg-navy rounded-card p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <HeroIcon size={17} color="white" />
            <h2 className="flex-1 text-[17px] font-medium text-white leading-tight min-w-0 truncate">
              {displayTrip.name}
            </h2>
            <ActionMenu
              buttonSize={32}
              iconSize={18}
              buttonStyle={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}
              items={[
                { label: 'Edit', onClick: () => setEditSheetOpen(true) },
                { label: 'Export as PDF', onClick: () => exportChecklistPDF(displayTrip, trip.sections || []) },
                { label: 'Remove', onClick: handleDeleteTrip, danger: true },
              ]}
            />
          </div>

          <p className="text-12 mb-3" style={{ color: '#aec6e8' }}>
            {[dates, nights > 0 && `${nights} night${nights !== 1 ? 's' : ''}`, displayTrip.tripType]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {[travellersDesc].filter(Boolean).map((pill, i) => (
              <span
                key={i}
                className="text-11 rounded-pill px-[9px] py-[3px]"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#deeeff' }}
              >
                {pill}
              </span>
            ))}
          </div>

          {totalProgress == null ? (
            <div className="flex items-center gap-2">
              <span className="text-12 whitespace-nowrap" style={{ color: '#aee8cc' }}>
                —
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-[5px] rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${animatedProgress}%`,
                    backgroundColor: '#2a9d6e',
                    transition: 'width 600ms ease-out',
                  }}
                />
              </div>
              <span className="text-12 whitespace-nowrap" style={{ color: '#aee8cc' }}>
                {animatedProgress}% ready
              </span>
            </div>
          )}
        </div>

        <WeatherCard
          forecastData={forecastData}
          storedWeather={displayTrip.weather}
          weatherOpen={weatherOpen}
          onToggle={() => setWeatherOpen(o => !o)}
        />

        {/* TODO: Re-enable AI suggestions — see /api/suggest.js */}
        {/* aiCount > 0 && (
          <div className="bg-white rounded-card mb-3" style={{ border: '0.5px solid #e8d8b0' }}>
            ...AI suggestions panel (kept for existing trips)...
          </div>
        ) */}

        {sectionsSorted.length === 0 && (
          <div
            className="bg-white rounded-card p-4 mb-3"
            style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
          >
            <p className="text-13 text-content-primary font-medium mb-1">No checklist yet</p>
            <p className="text-12 text-content-secondary mb-3 leading-relaxed">
              The packing list was not created for this trip. That usually means the template had no
              sections in the database, or the hierarchical checklist migration has not been applied
              to your project yet.
            </p>
            <div className="flex flex-col gap-2">
              {trip.templateId ? (
                <button
                  type="button"
                  disabled={recovering}
                  onClick={handleRebuildChecklist}
                  className="w-full py-2.5 rounded-button text-13 font-medium text-white bg-navy hover:bg-navy-hover disabled:opacity-50"
                >
                  Rebuild from template
                </button>
              ) : null}
              <button
                type="button"
                disabled={recovering}
                onClick={handleStarterChecklist}
                className="w-full py-2.5 rounded-button text-13 font-medium border border-[#e0ddd8] bg-page text-navy disabled:opacity-50"
              >
                Start with Essentials
              </button>
            </div>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <TrackLabel>SHARED</TrackLabel>
          {sharedSections.map(sec => (
            <SectionCard
              key={sec.id}
              mode="trip"
              section={sec}
              variant="shared"
              householdMembers={membersList}
              linkedTemplateId={trip.templateId}
              onAddCategory={addChecklistCategory}
              onRenameCategory={renameChecklistSubcategory}
              onRemoveCategory={removeSubcategory}
              quickAddTripItem={async (sectionId, categoryId, label) => {
                if (categoryId) {
                  return quickAddItem({ mode: 'category', subcategoryId: categoryId }, label)
                }
                return quickAddItem({ mode: 'section', sectionId }, label)
              }}
              onToggleItem={toggleItem}
              onSaveToTemplate={saveToTemplate}
              onRemoveItem={removeChecklistItem}
              onRemoveItemError={() => showToast("Couldn't delete — try again")}
              onUpdateItemLabel={renameChecklistItem}
              onRenameSectionHeader={updateSection}
              onRemoveSectionCard={removeSection}
            />
          ))}

          <TrackLabel>PEOPLE</TrackLabel>
          {personSections.map(sec => (
            <SectionCard
              key={sec.id}
              mode="trip"
              section={sec}
              variant="person"
              householdMembers={membersList}
              linkedTemplateId={trip.templateId}
              onAddCategory={addChecklistCategory}
              onRenameCategory={renameChecklistSubcategory}
              onRemoveCategory={removeSubcategory}
              quickAddTripItem={async (sectionId, categoryId, label) => {
                if (categoryId) {
                  return quickAddItem({ mode: 'category', subcategoryId: categoryId }, label)
                }
                return quickAddItem({ mode: 'section', sectionId }, label)
              }}
              onToggleItem={toggleItem}
              onSaveToTemplate={saveToTemplate}
              onRemoveItem={removeChecklistItem}
              onRemoveItemError={() => showToast("Couldn't delete — try again")}
              onUpdateItemLabel={renameChecklistItem}
              onRenameSectionHeader={updateSection}
              onRemoveSectionCard={removeSection}
            />
          ))}

          <TripAddCategoryPanel trip={trip} addSection={addSection} />
        </DndContext>
      </div>

      <EditTripSheet
        open={editSheetOpen}
        trip={displayTrip}
        onClose={() => setEditSheetOpen(false)}
        onSaved={updated => setLocalTrip(prev => ({ ...(prev ?? trip), ...updated }))}
      />

      {/* Bottom toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            fontSize: 13,
            padding: '8px 16px',
            borderRadius: 8,
            zIndex: 9999,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  )
}

function TripAddCategoryPanel({ trip, addSection }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('shared')
  const [sharedName, setSharedName] = useState('')
  const [personMemberId, setPersonMemberId] = useState('')

  const membersList = Array.isArray(trip?.members) ? trip.members : []
  const travellerIds = Array.isArray(trip?.travellers) ? trip.travellers : []
  const travellers = useMemo(
    () => membersList.filter(m => travellerIds.includes(m.id)),
    [membersList, travellerIds],
  )

  const usedPersonMemberIds = useMemo(() => {
    const set = new Set()
    for (const s of trip?.sections || []) {
      if (s.sectionType === 'person' && s.memberId) set.add(s.memberId)
    }
    return set
  }, [trip?.sections])

  const availableTravellers = useMemo(
    () => travellers.filter(m => !usedPersonMemberIds.has(m.id)),
    [travellers, usedPersonMemberIds],
  )

  const handleAddShared = async () => {
    const name = sharedName.trim()
    if (!name) return
    const id = await addSection({ sectionType: 'shared', name })
    if (id) setSharedName('')
  }

  const handleAddPerson = async () => {
    if (!personMemberId) {
      window.alert('Choose a household member who is not already on this trip.')
      return
    }
    const m = availableTravellers.find(x => x.id === personMemberId)
    const name = m?.name?.trim()
    if (!name) return
    const id = await addSection({ sectionType: 'person', name, memberId: personMemberId })
    if (!id) {
      window.alert('This traveller already has a section on this trip.')
      return
    }
    setPersonMemberId('')
  }

  return (
    <div
      className="bg-white rounded-card mb-[10px] overflow-hidden"
      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-3 text-start"
      >
        <span
          className="flex-1 text-track-label font-medium uppercase text-content-secondary"
          style={{ letterSpacing: '0.05em' }}
        >
          ADD SECTION
        </span>
        <ChevronDown
          size={18}
          className="text-content-hint flex-shrink-0"
          style={{
            transition: 'transform 200ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <div
        style={{
          display: 'grid',
          transition: 'grid-template-rows 250ms ease',
          gridTemplateRows: open ? '1fr' : '0fr',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            className="px-3 pb-3 border-t border-[rgba(0,0,0,0.06)]"
            style={{ backgroundColor: '#f8f7f4' }}
          >
            <div className="flex gap-2 pt-3 mb-3">
              <button
                type="button"
                onClick={() => setTab('shared')}
                className="text-12 font-medium rounded-input px-3 py-1.5 border border-transparent"
                style={
                  tab === 'shared'
                    ? { backgroundColor: '#fff', borderColor: '#e0ddd8', color: '#1a1a1a' }
                    : { backgroundColor: 'transparent', color: '#6b6b6b' }
                }
              >
                Shared section
              </button>
              <button
                type="button"
                onClick={() => setTab('person')}
                className="text-12 font-medium rounded-input px-3 py-1.5 border border-transparent"
                style={
                  tab === 'person'
                    ? { backgroundColor: '#fff', borderColor: '#e0ddd8', color: '#1a1a1a' }
                    : { backgroundColor: 'transparent', color: '#6b6b6b' }
                }
              >
                Person section
              </button>
            </div>

            {tab === 'shared' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={sharedName}
                  onChange={e => setSharedName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddShared()}
                  placeholder="Section name (e.g. Health, Snacks)"
                  className="w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                />
                <button
                  type="button"
                  onClick={handleAddShared}
                  className="w-full text-12 font-medium text-white bg-navy hover:bg-navy-hover rounded-input px-3 py-2.5"
                >
                  + Add section
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={personMemberId}
                  onChange={e => setPersonMemberId(e.target.value)}
                  disabled={availableTravellers.length === 0}
                  className={`w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy${
                    availableTravellers.length === 0 ? ' opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">
                    {availableTravellers.length === 0
                      ? 'Everyone already has a section'
                      : 'Select household member…'}
                  </option>
                  {availableTravellers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddPerson}
                  disabled={availableTravellers.length === 0}
                  className="w-full text-12 font-medium text-white bg-navy hover:bg-navy-hover rounded-input px-3 py-2.5 disabled:opacity-50"
                >
                  + Add section
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Weather card ────────────────────────────────────────────────────────────

const CONDITION_ICONS = {
  'Clear sky':              Sun,
  'Mainly clear':           Sun,
  'Partly cloudy':          CloudSun,
  'Overcast':               Cloud,
  'Foggy':                  Cloud,
  'Icy fog':                Cloud,
  'Light drizzle':          CloudDrizzle,
  'Drizzle':                CloudDrizzle,
  'Heavy drizzle':          CloudDrizzle,
  'Light rain':             CloudRain,
  'Rain':                   CloudRain,
  'Heavy rain':             CloudRain,
  'Rain showers':           CloudRain,
  'Showers':                CloudRain,
  'Heavy showers':          CloudRain,
  'Light snow':             CloudSnow,
  'Snow':                   CloudSnow,
  'Heavy snow':             CloudSnow,
  'Thunderstorm':           CloudLightning,
  'Thunderstorm with hail': CloudLightning,
  'Mixed conditions':       Cloud,
}

function conditionIcon(condition) {
  return CONDITION_ICONS[condition] ?? Cloud
}

function forecastSummary(days) {
  if (!days?.length) return { condition: '', tempMin: null, tempMax: null }
  const mins = days.map(d => d.tempMin).filter(v => v != null)
  const maxes = days.map(d => d.tempMax).filter(v => v != null)
  const freq = {}
  for (const d of days) freq[d.condition] = (freq[d.condition] || 0) + 1
  const condition = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return {
    condition,
    tempMin: mins.length  ? Math.min(...mins)  : null,
    tempMax: maxes.length ? Math.max(...maxes) : null,
  }
}

function formatDay(dateStr) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${dateStr}T12:00:00`))
}

/**
 * Resolves the forecast array to display from cache or stored DB weather.
 * Returns null if no valid structured forecast is available.
 */
function resolveWeatherForecast(forecastData, storedWeather) {
  // 1. Live cache takes priority
  if (forecastData?.forecast?.length) return forecastData.forecast

  // 2. Stored structured { forecast: [...] } in DB
  if (storedWeather && typeof storedWeather === 'object' && !Array.isArray(storedWeather)) {
    if (Array.isArray(storedWeather.forecast) && storedWeather.forecast.length) {
      return storedWeather.forecast
    }
  }

  // 3. Old plain-string data or null → nothing to show
  return null
}

function WeatherCard({ forecastData, storedWeather, weatherOpen, onToggle }) {
  const forecast = resolveWeatherForecast(forecastData, storedWeather)
  if (!forecast) return null

  const summary = forecastSummary(forecast)
  const SummaryIcon = conditionIcon(summary.condition)
  const summaryTemp =
    summary.tempMin != null && summary.tempMax != null
      ? `${summary.tempMin}–${summary.tempMax}°C`
      : summary.tempMax != null ? `${summary.tempMax}°C` : ''

  const isLong = forecast.length > 7

  return (
    <div
      className="bg-white rounded-card mb-3 overflow-hidden"
      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      {/* Collapsed header (always visible) */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={weatherOpen}
        className="w-full flex items-center gap-2 px-4 py-3 text-start"
      >
        <SummaryIcon size={16} className="flex-shrink-0" style={{ color: '#3d6494' }} />
        <span className="flex-1 text-13 text-content-primary">
          {[summary.condition, summaryTemp].filter(Boolean).join(' · ')}
        </span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-content-hint"
          style={{
            transition: 'transform 200ms ease',
            transform: weatherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Expanded content */}
      <div
        style={{
          display: 'grid',
          transition: 'grid-template-rows 250ms ease',
          gridTemplateRows: weatherOpen ? '1fr' : '0fr',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            className="px-4 pb-3 pt-2"
            style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', backgroundColor: '#f8f7f4' }}
          >
            {isLong ? (
              <p className="text-13 text-content-secondary">
                {['Overall:', summary.condition, summaryTemp && `${summaryTemp} range`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : (
              <div className="space-y-0.5">
                {forecast.map(day => {
                  const DayIcon = conditionIcon(day.condition)
                  return (
                    <div key={day.date} className="flex items-center gap-2 py-1">
                      <span className="text-13 shrink-0" style={{ color: '#6b6b6b', minWidth: 90 }}>
                        {formatDay(day.date)}
                      </span>
                      <DayIcon size={14} style={{ color: '#3d6494', flexShrink: 0 }} />
                      <span className="flex-1 text-13 text-content-primary">{day.condition}</span>
                      <span
                        className="text-13 whitespace-nowrap shrink-0"
                        style={{ color: '#6b6b6b', marginInlineStart: 'auto' }}
                      >
                        {day.tempMin}–{day.tempMax}°C
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
