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
      className="text-11 font-medium uppercase tracking-[0.08em] mb-2 mt-1"
      style={{ color: '#6b6b6b' }}
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
          <TrackLabel>Shared</TrackLabel>
          {sharedSections.map(sec => (
            <SectionCard
              key={sec.id}
              section={sec}
              variant="shared"
              templateId={trip.templateId}
              onToggleItem={toggleItem}
              quickAddItem={quickAddItem}
              onAddCategory={addChecklistCategory}
              removeChecklistItem={removeChecklistItem}
              onSaveToTemplate={saveToTemplate}
              onUpdateSection={updateSection}
              onRemoveSection={removeSection}
            />
          ))}

          <TrackLabel>People</TrackLabel>
          {personSections.map(sec => (
            <SectionCard
              key={sec.id}
              section={sec}
              variant="person"
              templateId={trip.templateId}
              onToggleItem={toggleItem}
              quickAddItem={quickAddItem}
              onAddCategory={addChecklistCategory}
              removeChecklistItem={removeChecklistItem}
              onSaveToTemplate={saveToTemplate}
              onUpdateSection={updateSection}
              onRemoveSection={removeSection}
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
  const [sharedName, setSharedName] = useState('')
  const [personMemberId, setPersonMemberId] = useState('')
  const [personName, setPersonName] = useState('')

  const membersList = Array.isArray(trip?.members) ? trip.members : []
  const travellerIds = Array.isArray(trip?.travellers) ? trip.travellers : []
  const travellers = useMemo(
    () => membersList.filter(m => travellerIds.includes(m.id)),
    [membersList, travellerIds],
  )

  const handleAddShared = async () => {
    const name = sharedName.trim()
    if (!name) return
    const id = await addSection({ sectionType: 'shared', name })
    if (id) setSharedName('')
  }

  const handleAddPerson = async () => {
    if (!personMemberId) {
      window.alert('Choose a traveller.')
      return
    }
    const fallback = travellers.find(m => m.id === personMemberId)?.name || ''
    const name = personName.trim() || fallback
    if (!name) return
    const id = await addSection({ sectionType: 'person', name, memberId: personMemberId })
    if (!id) {
      window.alert('This traveller already has a section on this trip.')
      return
    }
    setPersonName('')
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
        <span className="flex-1 text-11 font-medium uppercase tracking-[0.08em] text-content-secondary">
          Add section
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
            className="px-3 pb-3 space-y-4 border-t border-[rgba(0,0,0,0.06)]"
            style={{ backgroundColor: '#f8f7f4' }}
          >
            <div className="space-y-2 pt-3">
              <p className="text-12 font-medium text-content-primary">Shared section</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sharedName}
                  onChange={e => setSharedName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddShared()}
                  placeholder="Section name (e.g. Documents, Health)"
                  className="flex-1 text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                />
                <button
                  type="button"
                  onClick={handleAddShared}
                  className="text-12 font-medium text-white bg-navy rounded-input px-3 py-2 flex-shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-12 font-medium text-content-primary">Person section</p>
              <select
                value={personMemberId}
                onChange={e => {
                  const id = e.target.value
                  setPersonMemberId(id)
                  const m = travellers.find(x => x.id === id)
                  if (m) setPersonName(m.name)
                }}
                className="w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
              >
                <option value="">Select traveller…</option>
                {travellers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddPerson()}
                  placeholder={travellers.find(m => m.id === personMemberId)?.name || 'Traveller name'}
                  className="flex-1 text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                />
                <button
                  type="button"
                  onClick={handleAddPerson}
                  className="text-12 font-medium text-white bg-navy rounded-input px-3 py-2 flex-shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


function SectionCard({
  section,
  variant,
  templateId,
  onToggleItem,
  quickAddItem,
  onAddCategory,
  removeChecklistItem,
  onSaveToTemplate,
  onUpdateSection,
  onRemoveSection,
}) {
  const [expanded, setExpanded] = useState(true)
  const [newItemIds, setNewItemIds] = useState(new Set())
  const [saveErrors, setSaveErrors] = useState({})
  const [quickLabel, setQuickLabel] = useState('')
  const [quickTargetSubcategoryId, setQuickTargetSubcategoryId] = useState('')
  const [nameEditOpen, setNameEditOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(section.name)
  const [addCategoryDraft, setAddCategoryDraft] = useState('')
  const [addCategoryFormOpen, setAddCategoryFormOpen] = useState(false)

  useEffect(() => {
    setNameDraft(section.name)
  }, [section.name])

  useEffect(() => {
    setAddCategoryDraft('')
    setAddCategoryFormOpen(false)
  }, [section.id])

  useEffect(() => {
    const subs = [...(section.subcategories || [])].sort(
      (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
    )
    const first = subs[0]?.id
    setQuickTargetSubcategoryId(first ? String(first) : '')
  }, [section.id, section.subcategories])

  const sortedSubs = useMemo(
    () =>
      [...(section.subcategories || [])].sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
      ),
    [section.subcategories],
  )

  const { total: secTotal, checked: secChecked } = sectionItemTotals(section)

  const iconMeta = variant === 'shared' ? getSectionIconMeta(section.name) : null
  const SharedIc = iconMeta?.icon
  const displayMember = variant === 'person' ? memberForPersonSection(section) : null

  const handleSaveTpl = async itemId => {
    try {
      setSaveErrors(e => ({ ...e, [itemId]: null }))
      await onSaveToTemplate(itemId)
    } catch {
      setSaveErrors(e => ({ ...e, [itemId]: true }))
    }
  }

  const handleQuickAdd = async () => {
    const label = quickLabel.trim()
    if (!label) return
    let newId
    if (quickTargetSubcategoryId) {
      newId = await quickAddItem(
        { mode: 'category', subcategoryId: quickTargetSubcategoryId },
        label,
      )
    } else {
      newId = await quickAddItem({ mode: 'section', sectionId: section.id }, label)
    }
    if (newId) {
      setQuickLabel('')
      setNewItemIds(prev => new Set([...prev, newId]))
    }
  }

  const handleInlineAddCategory = async () => {
    const name = addCategoryDraft.trim()
    if (!name) return
    const id = await onAddCategory(section.id, name)
    if (id) {
      setAddCategoryDraft('')
      setAddCategoryFormOpen(false)
      setQuickTargetSubcategoryId(String(id))
    }
  }

  const closeAddCategoryForm = () => {
    setAddCategoryFormOpen(false)
    setAddCategoryDraft('')
  }

  const handleSaveRename = async () => {
    const n = nameDraft.trim()
    if (!n) return
    try {
      await onUpdateSection(section.id, n)
      setNameEditOpen(false)
    } catch {
      window.alert('Could not rename section.')
    }
  }

  const handleRemoveSection = async () => {
    const { total } = sectionItemTotals(section)
    if (
      !window.confirm(
        `Remove section "${section.name}" and everything inside (${total} item${total !== 1 ? 's' : ''})?`,
      )
    ) {
      return
    }
    try {
      await onRemoveSection(section.id)
    } catch {
      window.alert('Could not remove section.')
    }
  }

  return (
    <div
      className="bg-white rounded-card mb-[10px] overflow-hidden"
      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-[14px] py-[13px]"
        style={expanded ? { borderBottom: '0.5px solid rgba(0,0,0,0.08)' } : {}}
      >
        {variant === 'shared' && SharedIc ? (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: iconMeta.bg,
            }}
          >
            <SharedIc size={16} style={{ color: iconMeta.color }} />
          </div>
        ) : (
          <Avatar member={displayMember} size={32} />
        )}
        <span className="flex-1 text-14 font-medium text-content-primary text-left">
          {section.name}
        </span>

        <span className="text-12 text-content-secondary whitespace-nowrap mr-1">
          {secChecked}/{secTotal}
        </span>

        <ChevronDown
          size={16}
          className="flex-shrink-0 text-content-hint"
          style={{
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <div
        style={{
          display: 'grid',
          transition: 'grid-template-rows 250ms ease',
          gridTemplateRows: expanded ? '1fr' : '0fr',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="px-[14px] pt-2 pb-1 flex flex-wrap items-center justify-end gap-2 border-b border-[rgba(0,0,0,0.06)]">
            {nameEditOpen ? (
              <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveRename()}
                  className="flex-1 min-w-[8rem] text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="text-12 font-medium text-navy bg-transparent border-0 cursor-pointer p-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(section.name)
                    setNameEditOpen(false)
                  }}
                  className="text-12 text-content-secondary bg-transparent border-0 cursor-pointer p-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setNameEditOpen(true)}
                  className="text-11 bg-transparent border-0 cursor-pointer p-0"
                  style={{ color: '#2d6fb5' }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={handleRemoveSection}
                  className="text-11 text-content-hint bg-transparent border-0 cursor-pointer p-0"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <div className="px-[14px] pt-2 pb-[13px] space-y-3">
            {secTotal === 0 && (
              <p className="text-11 italic mb-1" style={{ color: '#9a9a9a' }}>
                No items yet — use Add item below
              </p>
            )}
            {sortedSubs.map((sub, idx) => (
              <GroupLabelBlock
                key={sub.id}
                sub={sub}
                isFirstGroup={idx === 0}
                templateId={templateId}
                newItemIds={newItemIds}
                onToggleItem={onToggleItem}
                onSaveToTemplate={handleSaveTpl}
                saveError={saveErrors}
                removeChecklistItem={removeChecklistItem}
              />
            ))}

            <div className="pt-1 space-y-2">
              {addCategoryFormOpen ? (
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    value={addCategoryDraft}
                    onChange={e => setAddCategoryDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleInlineAddCategory()
                      if (e.key === 'Escape') closeAddCategoryForm()
                    }}
                    placeholder="Category name"
                    autoComplete="off"
                    className="flex-1 min-w-[10rem] text-13 text-content-primary rounded-input px-3 py-2 bg-white focus:outline-none focus:border-navy border border-[#e0ddd8]"
                  />
                  <button
                    type="button"
                    onClick={handleInlineAddCategory}
                    className="text-12 font-medium text-white bg-navy hover:bg-navy-hover rounded-input px-3 py-2 flex-shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={closeAddCategoryForm}
                    className="flex-shrink-0 p-2 rounded-input border-0 bg-transparent text-content-hint cursor-pointer inline-flex items-center justify-center"
                    aria-label="Cancel adding category"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddCategoryFormOpen(true)}
                  className="text-12 font-medium bg-transparent border-0 cursor-pointer p-0"
                  style={{ color: '#2d6fb5' }}
                >
                  + Add category
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-[rgba(0,0,0,0.06)] space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickLabel}
                  onChange={e => setQuickLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="Add item…"
                  className="flex-1 text-13 text-content-primary rounded-input px-3 py-2 bg-white focus:outline-none"
                  style={{ border: '1px dashed #e0ddd8' }}
                />
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className="text-12 font-medium text-white bg-navy hover:bg-navy-hover rounded-input px-3 py-[7px] flex-shrink-0 transition-colors"
                >
                  Add
                </button>
              </div>
              {sortedSubs.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-11 text-content-secondary">Category</label>
                  <select
                    value={quickTargetSubcategoryId}
                    onChange={e => setQuickTargetSubcategoryId(e.target.value)}
                    aria-label="Category for new item"
                    className="w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                  >
                    {sortedSubs.map(sub => (
                      <option key={sub.id} value={String(sub.id)}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistSubcategoryEmptyDrop({ subId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${subId}` })
  return (
    <div
      ref={setNodeRef}
      className="rounded-input mb-1 px-1 -mx-1"
      style={{
        minHeight: 36,
        outline: isOver ? '2px dashed #2d6fb5' : undefined,
        outlineOffset: 2,
      }}
    >
      {children}
    </div>
  )
}

function ChecklistSubcategoryTailDrop({ subId }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-end:${subId}` })
  return (
    <div
      ref={setNodeRef}
      className="h-3 rounded-input w-full shrink-0"
      style={{ backgroundColor: isOver ? 'rgba(45,111,181,0.12)' : undefined }}
      aria-hidden
    />
  )
}

function GroupLabelBlock({
  sub,
  isFirstGroup,
  templateId,
  newItemIds,
  onToggleItem,
  onSaveToTemplate,
  saveError,
  removeChecklistItem,
}) {
  const sortedItems = useMemo(
    () =>
      [...(sub.items || [])].sort(
        (a, b) =>
          (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
          String(a.label).localeCompare(String(b.label)),
      ),
    [sub.items],
  )

  const itemIds = useMemo(() => sortedItems.map(i => i.id), [sortedItems])
  const canSaveToTemplate = Boolean(templateId)

  return (
    <div>
      <p
        className="font-medium uppercase"
        style={{
          fontSize: 11,
          color: '#6b6b6b',
          letterSpacing: '0.06em',
          marginTop: isFirstGroup ? 0 : 12,
          marginBottom: 4,
        }}
      >
        {sub.name}
      </p>
      {sortedItems.length === 0 ? (
        <ChecklistSubcategoryEmptyDrop subId={sub.id}>
          <p className="text-11 mb-2 italic" style={{ color: '#9a9a9a' }}>
            No items yet
          </p>
        </ChecklistSubcategoryEmptyDrop>
      ) : (
        <>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {sortedItems.map((item, index) => (
              <div key={item.id}>
                <SortableChecklistRow
                  item={item}
                  showBorder={index < sortedItems.length - 1}
                  isNew={newItemIds.has(item.id)}
                  canSaveToTemplate={canSaveToTemplate}
                  onToggle={() => onToggleItem(item.id)}
                  onSave={() => onSaveToTemplate(item.id)}
                  saveFailed={saveError[item.id]}
                  onDelete={() => removeChecklistItem(item.id)}
                />
              </div>
            ))}
          </SortableContext>
          <ChecklistSubcategoryTailDrop subId={sub.id} />
        </>
      )}
    </div>
  )
}

function SortableChecklistRow(props) {
  const { item } = props
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 2 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ChecklistItemRow
        {...props}
        activatorRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

function ChecklistItemRow({
  item,
  showBorder,
  isNew,
  canSaveToTemplate,
  onToggle,
  onSave,
  saveFailed,
  onDelete,
  activatorRef,
  dragAttributes,
  dragListeners,
}) {
  const showSaveToTemplate = canSaveToTemplate && !item.savedToTemplate && item.isManuallyAdded
  const canDelete = item.isManuallyAdded
  const [showDelete, setShowDelete] = useState(false)
  const longPressTimer = useRef(null)
  const touchStartX = useRef(null)

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => () => clearLongPress(), [])

  const handleDeleteClick = async e => {
    e.stopPropagation()
    try {
      await onDelete()
    } catch {
      window.alert('Could not remove item.')
    }
    setShowDelete(false)
  }

  return (
    <div
      className={['flex items-center gap-2 py-[9px]', isNew ? 'item-appear' : ''].join(' ')}
      style={showBorder ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}}
      onTouchStart={e => {
        touchStartX.current = e.touches[0].clientX
      }}
      onTouchEnd={e => {
        const x0 = touchStartX.current
        touchStartX.current = null
        if (x0 == null || !canDelete) return
        const dx = x0 - e.changedTouches[0].clientX
        if (dx > 48) setShowDelete(true)
      }}
    >
      <button
        type="button"
        ref={activatorRef}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-content-hint p-0 bg-transparent border-0 inline-flex items-center justify-center"
        aria-label="Drag to reorder"
        {...dragAttributes}
        {...dragListeners}
      >
        <GripVertical size={14} style={{ opacity: 0.3 }} />
      </button>

      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
        className={[
          'w-[18px] h-[18px] rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer checkbox-interactive',
          item.checked ? '' : '',
        ].join(' ')}
        style={
          !item.checked
            ? { border: '1.5px solid rgba(0,0,0,0.2)' }
            : { backgroundColor: '#2a9d6e' }
        }
      >
        {item.checked && <Check size={11} color="white" strokeWidth={3} />}
      </div>

      <span
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
        onPointerDown={
          canDelete
            ? () => {
                clearLongPress()
                longPressTimer.current = window.setTimeout(() => setShowDelete(true), 500)
              }
            : undefined
        }
        onPointerUp={canDelete ? clearLongPress : undefined}
        onPointerLeave={canDelete ? clearLongPress : undefined}
        onPointerCancel={canDelete ? clearLongPress : undefined}
        onClick={onToggle}
        className={[
          'flex-1 text-13 min-w-0 transition-colors cursor-pointer text-left bg-transparent border-0 p-0',
          item.checked ? 'line-through' : 'text-content-primary',
        ].join(' ')}
        style={item.checked ? { color: '#9a9a9a' } : undefined}
      >
        {item.label}
      </span>

      {saveFailed && (
        <span className="text-11 flex-shrink-0" style={{ color: '#c03434' }}>
          Couldn&apos;t save
        </span>
      )}

      {showSaveToTemplate && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onSave()
          }}
          className="flex items-center gap-1 flex-shrink-0 bg-transparent border-0 cursor-pointer p-0"
          style={{ color: '#2d6fb5', fontSize: 11 }}
        >
          <BookmarkPlus size={12} />
          Save to template
        </button>
      )}
      {item.savedToTemplate && (
        <span className="flex items-center gap-1 text-11 flex-shrink-0" style={{ color: '#2a9d6e' }}>
          <Check size={11} />
          ✓ Saved
        </span>
      )}

      {canDelete && showDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="flex-shrink-0 text-11 font-medium px-1.5 py-0.5 rounded bg-transparent border-0 cursor-pointer"
          style={{ color: '#c03434' }}
          aria-label="Remove item"
        >
          ×
        </button>
      )}
    </div>
  )
}
