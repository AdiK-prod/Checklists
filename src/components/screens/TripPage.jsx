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
  MoreVertical,
  Plane,
  Car,
  Moon,
  Sparkles,
  ChevronDown,
  GripVertical,
  Check,
  BookmarkPlus,
  CloudSun,
  X,
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import { Skeleton, SkeletonPersonCard } from '../ui/Skeleton'
import { formatTripDates, computeNights } from '../../lib/utils'
import { getSectionIconMeta } from '../../lib/sectionIcons'
import SectionCard from '../ui/SectionCard'
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
      className="text-11 font-medium uppercase mb-2 mt-1"
      style={{ color: '#6b6b6b', letterSpacing: '0.07em' }}
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
  } = useTripDetail(tripId)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [recovering, setRecovering] = useState(false)

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
            <ArrowLeft size={16} /> All trips
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

  const HeroIcon = iconFromTripType(trip.tripType)
  const dates = formatTripDates(trip.datesFrom, trip.datesTo)
  const nights = computeNights(trip.datesFrom, trip.datesTo)
  const aiCount = (trip.aiSuggestions || []).length
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

  const weatherText = trip.weather && String(trip.weather).trim()
  const weatherPreview = (() => {
    if (!weatherText) return ''
    const line = weatherText.split('\n')[0].trim()
    if (line.length <= 96) return line
    return `${line.slice(0, 93).trimEnd()}…`
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

  return (
    <div className="bg-page">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => navigate('/', { state: { direction: 'back' } })}
          className="flex items-center gap-1 text-13"
          style={{ color: '#2d6fb5' }}
        >
          <ArrowLeft size={16} />
          All trips
        </button>
        <button className="text-content-hint" aria-label="More options">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="px-4 pb-8">
        <div className="bg-navy rounded-card p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <HeroIcon size={17} color="white" />
            <h2 className="text-[17px] font-medium text-white leading-tight">{trip.name}</h2>
          </div>

          <p className="text-12 mb-3" style={{ color: '#aec6e8' }}>
            {[dates, nights > 0 && `${nights} night${nights !== 1 ? 's' : ''}`, trip.tripType]
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

        {weatherText && (
          <div
            className="bg-white rounded-card mb-3 overflow-hidden"
            style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
          >
            <button
              type="button"
              onClick={() => setWeatherOpen(o => !o)}
              aria-expanded={weatherOpen}
              className="w-full flex items-start gap-2 px-4 py-3 text-left"
            >
              <CloudSun size={18} className="flex-shrink-0 mt-0.5 text-content-secondary" />
              <span className="flex-1 min-w-0">
                <span className="block text-13 font-medium text-content-primary">Weather</span>
                {!weatherOpen && (
                  <span className="block text-12 text-content-secondary mt-0.5 leading-snug line-clamp-2">
                    {weatherPreview}
                  </span>
                )}
              </span>
              <ChevronDown
                size={18}
                className="flex-shrink-0 text-content-hint mt-0.5"
                style={{
                  transition: 'transform 200ms ease',
                  transform: weatherOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>
            <div
              style={{
                display: 'grid',
                transition: 'grid-template-rows 250ms ease',
                gridTemplateRows: weatherOpen ? '1fr' : '0fr',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div
                  className="px-4 pb-3 text-12 text-content-primary leading-relaxed whitespace-pre-wrap"
                  style={{
                    borderTop: '0.5px solid rgba(0,0,0,0.06)',
                    backgroundColor: '#f8f7f4',
                    maxHeight: 'min(70vh, 28rem)',
                    overflowY: 'auto',
                  }}
                >
                  {weatherText}
                </div>
              </div>
            </div>
          </div>
        )}

        {aiCount > 0 && (
          <div className="bg-white rounded-card mb-3" style={{ border: '0.5px solid #e8d8b0' }}>
            <button
              onClick={() => setAiPanelOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3"
            >
              <Sparkles size={15} style={{ color: '#c47d1a', flexShrink: 0 }} />
              <span className="flex-1 text-13 font-medium text-left" style={{ color: '#7a4f0d' }}>
                Suggestions included
              </span>
              <span
                className="text-11 font-medium text-white rounded-full px-2 py-0.5 mr-1"
                style={{ backgroundColor: '#c47d1a' }}
              >
                {aiCount}
              </span>
              <ChevronDown
                size={16}
                style={{
                  color: '#7a4f0d',
                  flexShrink: 0,
                  transition: 'transform 200ms ease',
                  transform: aiPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            <div
              style={{
                display: 'grid',
                transition: 'grid-template-rows 250ms ease',
                gridTemplateRows: aiPanelOpen ? '1fr' : '0fr',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div
                  className="px-4 pb-3"
                  style={{ borderTop: '0.5px solid #e8d8b0', backgroundColor: '#fffaf3' }}
                >
                  {trip.aiSuggestions.map((s, i) => {
                    const assignedNames = (s.assignedTo || [])
                      .map(id => trip.members.find(m => m.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')
                    return (
                      <div key={i} className="pt-2.5">
                        <p className="text-13 font-medium text-content-primary">{s.label}</p>
                        {assignedNames && (
                          <p className="text-11 text-content-secondary mt-0.5">Added to: {assignedNames}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

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
              onRenameSectionHeader={updateSection}
              onRemoveSectionCard={removeSection}
            />
          ))}

          <TripAddCategoryPanel trip={trip} addSection={addSection} />
        </DndContext>
      </div>
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
        className="w-full flex items-center gap-2 px-3 py-3 text-left"
      >
        <span
          className="flex-1 text-11 font-medium uppercase text-content-secondary"
          style={{ letterSpacing: '0.07em' }}
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


