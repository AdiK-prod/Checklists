import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, MoreVertical, Plane, Car, Moon,
  Sparkles, ChevronDown, GripVertical, Check,
  BookmarkPlus,
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import { formatTripDates, computeNights, computeProgress, describeTravellers, groupByCategory } from '../../lib/utils'
import { TEMPLATES } from '../../data/templates'

// DEMO SCAFFOLDING — TEMPLATES import removed in Module 10

const TEMPLATE_ICONS = { 'template-flight': Plane, 'template-day': Car, 'template-weekend': Moon }

export default function TripPage({ trip, members, onToggleItem, onAddItem, onSaveToTemplate, navigate }) {
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  const totalProgress = computeProgress(trip.checklists)

  // Animate progress bar from 0 on mount
  const isInitialMount = useRef(true)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      const t = setTimeout(() => setAnimatedProgress(totalProgress), 200)
      return () => clearTimeout(t)
    }
    setAnimatedProgress(totalProgress)
  }, [totalProgress])

  const dates        = formatTripDates(trip.datesFrom, trip.datesTo)
  const nights       = computeNights(trip.datesFrom, trip.datesTo)
  const travellerDesc = describeTravellers(trip.travellers, members)
  const template     = TEMPLATES.find(t => t.id === trip.templateId)
  const HeroIcon     = TEMPLATE_ICONS[trip.templateId] ?? Plane

  const travellersForTrip = members.filter(m => trip.travellers.includes(m.id))

  const aiCount = (trip.aiSuggestions || []).length

  return (
    <div className="min-h-screen bg-page">

      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={navigate.toDashboard}
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

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="px-4 pb-8">

        {/* Hero card */}
        <div className="bg-navy rounded-card p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <HeroIcon size={17} color="white" />
            <h2 className="text-[17px] font-medium text-white leading-tight">{trip.name}</h2>
          </div>

          <p className="text-12 mb-3" style={{ color: '#aec6e8' }}>
            {[dates, nights > 0 && `${nights} night${nights !== 1 ? 's' : ''}`, template?.name]
              .filter(Boolean).join(' · ')}
          </p>

          {/* Pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[trip.weather, travellerDesc, trip.tripType].filter(Boolean).map((pill, i) => (
              <span
                key={i}
                className="text-11 rounded-pill px-[9px] py-[3px]"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#deeeff' }}
              >
                {pill}
              </span>
            ))}
          </div>

          {/* Progress row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${animatedProgress}%`, backgroundColor: '#2a9d6e', transition: 'width 600ms ease-out' }}
              />
            </div>
            <span className="text-12 whitespace-nowrap" style={{ color: '#aee8cc' }}>
              {animatedProgress}% ready
            </span>
          </div>
        </div>

        {/* AI suggestions panel */}
        {aiCount > 0 && (
          <div className="bg-white rounded-card mb-3" style={{ border: '0.5px solid #e8d8b0' }}>
            {/* Collapsed header */}
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
                style={{ color: '#7a4f0d', flexShrink: 0, transition: 'transform 200ms ease', transform: aiPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {/* Collapsible body */}
            <div style={{ display: 'grid', transition: 'grid-template-rows 250ms ease', gridTemplateRows: aiPanelOpen ? '1fr' : '0fr' }}>
              <div style={{ overflow: 'hidden' }}>
                <div className="px-4 pb-3" style={{ borderTop: '0.5px solid #e8d8b0', backgroundColor: '#fffaf3' }}>
                  {trip.aiSuggestions.map((s, i) => {
                    const assignedNames = (s.assignedTo || [])
                      .map(id => members.find(m => m.id === id)?.name)
                      .filter(Boolean).join(', ')
                    return (
                      <div key={i} className="pt-2.5">
                        <p className="text-13 font-medium text-content-primary">{s.label}</p>
                        {assignedNames && (
                          <p className="text-11 text-content-secondary mt-0.5">
                            Added to: {assignedNames}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Person cards */}
        {travellersForTrip.map(member => (
          <PersonCard
            key={member.id}
            member={member}
            items={trip.checklists[member.id] || []}
            tripId={trip.id}
            onToggleItem={onToggleItem}
            onAddItem={onAddItem}
            onSaveToTemplate={onSaveToTemplate}
          />
        ))}
      </div>
    </div>
  )
}

// ── Person card ───────────────────────────────────────────────

function PersonCard({ member, items, tripId, onToggleItem, onAddItem, onSaveToTemplate }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [addInput, setAddInput] = useState('')
  const [newItemIds, setNewItemIds] = useState(new Set())

  const checked = items.filter(i => i.checked).length
  const total   = items.length
  const pct     = total === 0 ? 0 : Math.round((checked / total) * 100)
  const groups  = groupByCategory(items)

  const handleAdd = () => {
    const label = addInput.trim()
    if (!label) return
    const newId = onAddItem(tripId, member.id, label)
    if (newId) setNewItemIds(prev => new Set([...prev, newId]))
    setAddInput('')
  }

  return (
    <div className="bg-white rounded-card mb-[10px] overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-[14px] py-[13px]"
        style={isExpanded ? { borderBottom: '0.5px solid rgba(0,0,0,0.08)' } : {}}
      >
        <Avatar member={member} size={32} />
        <span className="flex-1 text-14 font-medium text-content-primary text-left">{member.name}</span>

        {/* Mini progress bar + N/N */}
        <div className="flex items-center gap-1.5 mr-1">
          <div className="h-[3px] rounded-full overflow-hidden bg-surface" style={{ width: 44 }}>
            <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-12 text-content-secondary whitespace-nowrap">{checked}/{total}</span>
        </div>

        <ChevronDown
          size={16}
          className="flex-shrink-0 text-content-hint"
          style={{ transition: 'transform 200ms ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Collapsible body */}
      <div style={{ display: 'grid', transition: 'grid-template-rows 250ms ease', gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
        <div style={{ overflow: 'hidden' }}>
          <div className="px-[14px] pt-2 pb-[13px]">
            {groups.map(({ category, items: catItems }) => (
              <div key={category} className="mb-3 last:mb-0">
                <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-1.5">
                  {category}
                </p>
                {catItems.map((item, idx) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    isLast={idx === catItems.length - 1}
                    isNew={newItemIds.has(item.id)}
                    onToggle={() => onToggleItem(tripId, member.id, item.id)}
                    onSave={() => onSaveToTemplate(tripId, member.id, item.id)}
                  />
                ))}
              </div>
            ))}

            {/* Add item row */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Add item…"
                className="flex-1 text-13 text-content-primary rounded-input px-3 py-2 bg-white focus:outline-none"
                style={{ border: '1px dashed #e0ddd8' }}
              />
              <button
                onClick={handleAdd}
                className="text-12 font-medium text-white bg-navy hover:bg-navy-hover rounded-input px-3 py-[7px] flex-shrink-0 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Checklist item row ────────────────────────────────────────

function ChecklistItemRow({ item, isLast, isNew, onToggle, onSave }) {
  return (
    <div
      className={['flex items-center gap-2 py-[9px]', isNew ? 'item-appear' : ''].join(' ')}
      style={!isLast ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}}
    >
      {/* TODO L3: implement drag-to-reorder with react-beautiful-dnd */}
      <GripVertical size={14} className="flex-shrink-0" style={{ opacity: 0.3, cursor: 'grab' }} />

      {/* Checkbox 18×18 */}
      <div
        onClick={onToggle}
        className={[
          'w-[18px] h-[18px] rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer checkbox-interactive',
          item.checked ? 'bg-success' : '',
        ].join(' ')}
        style={!item.checked ? { border: '1.5px solid rgba(0,0,0,0.2)' } : {}}
      >
        {item.checked && <Check size={11} color="white" strokeWidth={3} />}
      </div>

      {/* Label */}
      <span className={['flex-1 text-13 min-w-0 transition-colors', item.checked ? 'line-through text-content-hint' : 'text-content-primary'].join(' ')}>
        {item.label}
      </span>

      {/* Save to template — manually added items only */}
      {item.isManuallyAdded && !item.savedToTemplate && (
        <button
          onClick={onSave}
          className="flex items-center gap-1 text-11 flex-shrink-0"
          style={{ color: '#2d6fb5' }}
        >
          <BookmarkPlus size={12} />
          Save to template
          {/* TODO L2: persist saved item back to template_items in Supabase */}
        </button>
      )}
      {item.isManuallyAdded && item.savedToTemplate && (
        <span className="flex items-center gap-1 text-11 flex-shrink-0" style={{ color: '#2a9d6e' }}>
          <Check size={11} />
          Saved
        </span>
      )}
    </div>
  )
}
