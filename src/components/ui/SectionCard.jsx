import { useState, useEffect, useMemo, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Check, BookmarkPlus, X } from 'lucide-react'
import Avatar from './Avatar'
import ActionMenu from './ActionMenu'
import { getSectionIconMeta } from '../../lib/sectionIcons'
import { isDefaultBucketSubcategoryName } from '../../lib/templateLayout'

/**
 * Props (shared checklist / template section UI)
 *
 * @param {'trip'|'template'} mode
 * @param {object} section — { id, name, sectionType, memberId?, member?, sortOrder?, subcategories }
 * @param {'shared'|'person'} variant
 * @param {object[]} [householdMembers] — resolve avatar when section.member absent (templates)
 * @param {string|null} [linkedTemplateId] — trip: template id for "Save to template" (omit in template mode)
 * @param {string} [workingTemplateId] — template mode: owning template row id for callbacks
 *
 * Categories & items:
 * @param {(sectionId: string, name: string) => Promise<string|null>} onAddCategory
 * @param {(categoryId: string, name: string) => Promise<void>} onRenameCategory
 * @param {(categoryId: string) => Promise<void>} onRemoveCategory
 * @param {(sectionId: string, categoryId?: string|null, label: string) => Promise<string|null>} quickAddTripItem — categoryId null ⇒ lazy Items bucket for section
 * @param {(workingTemplateId: string, sectionId: string, categoryId?: string|null, label: string) => Promise<string|null>} quickAddTemplateItem
 * @param {(itemId: string) => void|Promise<void>} [onToggleItem] — trip only
 * @param {(itemId: string) => void|Promise<void>} [onSaveToTemplate]
 * @param {(itemId: string) => void|Promise<void>} onRemoveItem
 * @param {(sectionId: string, name: string) => Promise<void>} onRenameSectionHeader
 * @param {(sectionId: string) => Promise<void>} onRemoveSectionCard
 * @param {(itemId: string, label: string) => Promise<void>} [onUpdateItemLabel]
 */

export const SECTION_INLINE_SHELL = {
  backgroundColor: '#f5f4f1',
  borderRadius: 8,
  padding: '5px 7px',
}

export const SECTION_LINK_ACCENT = { fontSize: 11, color: '#3d6494' }

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function fallbackMemberFromSection(section) {
  return {
    id: section.memberId || section.id,
    name: section.name,
    role: 'parent',
    age: null,
    initials: initialsFromName(section.name),
    avatarColour: { bg: '#f1efe8', text: '#6b6b6b' },
  }
}

function resolveDisplayMember(section, householdMembers) {
  if (section.member) {
    const m = section.member
    return {
      ...m,
      initials: m.initials || initialsFromName(m.name || ''),
      avatarColour: m.avatarColour || { bg: '#f1efe8', text: '#6b6b6b' },
    }
  }
  if (section.memberId && Array.isArray(householdMembers)) {
    const m = householdMembers.find(x => x.id === section.memberId)
    if (m) {
      return {
        ...m,
        initials:
          m.initials ||
          initialsFromName(m.name),
        avatarColour: m.avatarColour || { bg: '#f1efe8', text: '#6b6b6b' },
      }
    }
  }
  return fallbackMemberFromSection(section)
}

export function sectionItemTotals(section) {
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

function sortCategoryItems(items) {
  return [...(items || [])].sort(
    (a, b) =>
      (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
      String(a.label).localeCompare(String(b.label)),
  )
}

function SectionInlineShell({ children, style: styleProp = {}, ...rest }) {
  return (
    <div
      className="flex gap-2 items-center flex-wrap mb-2"
      style={{ ...SECTION_INLINE_SHELL, ...styleProp }}
      {...rest}
    >
      {children}
    </div>
  )
}

function SubcategoryEmptyDrop({ subId, children }) {
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

function SubcategoryTailDrop({ subId }) {
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

/** Trip checklist row (checkbox, save-to-template, swipe/hover delete) */
function SortableTripItemRow(props) {
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
      <TripItemRow
        {...props}
        activatorRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
        onDeleteError={props.onDeleteError}
      />
    </div>
  )
}

function TripItemRow({
  item,
  showBorder,
  isNew,
  canSaveToTemplate,
  onToggle,
  onSave,
  saveFailed,
  onDelete,
  onDeleteError,
  activatorRef,
  dragAttributes,
  dragListeners,
  isEditingLabel,
  editDraft,
  onEditDraftChange,
  onEditCommit,
  onEditCancel,
  onStartEdit,
  editCancelRef,
}) {
  // All items are deletable (rule 1)
  const isUserAdded = Boolean(item.isManuallyAdded || item.isAiSuggested)
  const showSaveToTemplate = Boolean(
    canSaveToTemplate && !item.savedToTemplate && isUserAdded,
  )

  // saveFlash: null | 'saving' | 'saved'  (drives 2-second flash then nothing)
  const [saveFlash, setSaveFlash]   = useState(null)
  const saveFlashTimer              = useRef(null)

  // Mobile swipe-to-delete state
  const [swipeRevealed, setSwipeRevealed] = useState(false)
  const touchStartX                       = useRef(null)
  const touchStartY                       = useRef(null)

  // Desktop hover state
  const [hovered, setHovered] = useState(false)

  useEffect(() => () => {
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current)
  }, [])

  // Reset swipe reveal when item changes (e.g. after save)
  useEffect(() => { setSwipeRevealed(false) }, [item.id])

  const handleSave = e => {
    e.stopPropagation()
    if (saveFlash === 'saving') return
    setSaveFlash('saving')
    Promise.resolve(onSave()).then(() => {
      setSaveFlash('saved')
      saveFlashTimer.current = setTimeout(() => setSaveFlash(null), 2000)
    }).catch(() => {
      setSaveFlash(null)
    })
  }

  const handleDeleteClick = async e => {
    e.stopPropagation()
    setSwipeRevealed(false)
    try {
      await onDelete()
    } catch {
      onDeleteError?.()
    }
  }

  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = e => {
    const x0 = touchStartX.current
    const y0 = touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (x0 == null) return
    const dx = x0 - e.changedTouches[0].clientX
    const dy = Math.abs(e.changedTouches[0].clientY - y0)
    // Only treat as horizontal swipe if more horizontal than vertical
    if (dx > 40 && dy < 20) {
      setSwipeRevealed(true)
    } else if (dx < -20) {
      setSwipeRevealed(false)
    }
  }

  // Right-action slot: save prompt → 2s flash → nothing
  const rightAction = (() => {
    if (saveFlash === 'saved') {
      return (
        <span className="flex items-center gap-1 text-11 flex-shrink-0" style={{ color: '#2a9d6e' }}>
          ✓ Added to template
        </span>
      )
    }
    if (showSaveToTemplate && saveFlash !== 'saving') {
      return (
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1 flex-shrink-0 bg-transparent border-0 cursor-pointer p-0"
          style={{ color: '#2d6fb5', fontSize: 11 }}
        >
          <BookmarkPlus size={12} />
          Save to template
        </button>
      )
    }
    if (saveFailed) {
      return (
        <span className="text-11 flex-shrink-0" style={{ color: '#c03434' }}>
          Couldn&apos;t save
        </span>
      )
    }
    return null
  })()

  return (
    <div
      className={['relative overflow-hidden', isNew ? 'item-appear' : ''].join(' ')}
      style={showBorder ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main row content — slides left on swipe to reveal delete zone */}
      <div
        className="flex items-center gap-2 py-[9px] pr-1"
        style={{
          transform: swipeRevealed ? 'translateX(-56px)' : 'translateX(0)',
          transition: 'transform 200ms ease',
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
          className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer checkbox-interactive"
          style={
            !item.checked
              ? { border: '1.5px solid rgba(0,0,0,0.2)' }
              : { backgroundColor: '#2a9d6e' }
          }
        >
          {item.checked && <Check size={11} color="white" strokeWidth={3} />}
        </div>

        {isEditingLabel ? (
          <input
            type="text"
            autoFocus
            value={editDraft}
            onChange={e => onEditDraftChange(e.target.value)}
            onBlur={() => {
              if (!editCancelRef.current) onEditCommit()
              editCancelRef.current = false
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { editCancelRef.current = false; e.currentTarget.blur() }
              if (e.key === 'Escape') onEditCancel(item.label)
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 text-item-label rounded-input border-0 outline-none px-1.5 py-0.5"
            style={{ background: '#f5f4f1', borderRadius: 8 }}
          />
        ) : (
          <span
            role={item.checked ? undefined : 'button'}
            tabIndex={item.checked ? undefined : 0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
            onClick={item.checked ? onToggle : () => onStartEdit(item)}
            className={[
              'flex-1 text-item-label min-w-0 transition-colors text-start bg-transparent border-0 p-0',
              item.checked ? 'line-through cursor-pointer' : 'text-content-primary cursor-text',
            ].join(' ')}
            style={item.checked ? { color: '#9a9a9a' } : undefined}
          >
            {item.label}
          </span>
        )}

        {/* Right action (save / flash / error) */}
        {rightAction}

        {/* Desktop hover × */}
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label="Remove item"
          className="flex-shrink-0 flex items-center justify-center bg-transparent border-0 cursor-pointer rounded"
          style={{
            width: 24,
            height: 24,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 120ms',
            color: '#9a9a9a',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e24b4a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9a9a9a' }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Mobile swipe-revealed red delete zone */}
      <button
        type="button"
        onClick={handleDeleteClick}
        aria-label="Remove item"
        className="absolute top-0 right-0 bottom-0 flex items-center justify-center"
        style={{
          width: 56,
          backgroundColor: '#e24b4a',
          borderRadius: '0 8px 8px 0',
          border: 'none',
          cursor: 'pointer',
          opacity: swipeRevealed ? 1 : 0,
          pointerEvents: swipeRevealed ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      >
        <X size={16} color="white" strokeWidth={2.5} />
      </button>
    </div>
  )
}

/** Template editing row — swipe/hover delete with inline confirmation */
function SortableTemplateItemRow({
  item,
  showBorder,
  onRemove,
  onRemoveError,
  isEditingLabel,
  editDraft,
  onEditDraftChange,
  onEditCommit,
  onEditCancel,
  onStartEdit,
  editCancelRef,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 2 : undefined,
  }

  const [confirmOpen, setConfirmOpen]     = useState(false)
  const [swipeRevealed, setSwipeRevealed] = useState(false)
  const [hovered, setHovered]             = useState(false)
  const confirmTimerRef                   = useRef(null)
  const touchStartX                       = useRef(null)
  const touchStartY                       = useRef(null)

  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }, [])
  useEffect(() => { setSwipeRevealed(false); setConfirmOpen(false) }, [item.id])

  const openConfirm = () => {
    setSwipeRevealed(false)
    setConfirmOpen(true)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => setConfirmOpen(false), 4000)
  }

  const cancelConfirm = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmOpen(false)
  }

  const handleConfirmRemove = async () => {
    cancelConfirm()
    try { await onRemove() } catch { onRemoveError?.() }
  }

  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = e => {
    const x0 = touchStartX.current, y0 = touchStartY.current
    touchStartX.current = null; touchStartY.current = null
    if (x0 == null) return
    const dx = x0 - e.changedTouches[0].clientX
    const dy = Math.abs(e.changedTouches[0].clientY - y0)
    if (dx > 40 && dy < 20) setSwipeRevealed(true)
    else if (dx < -20) setSwipeRevealed(false)
  }

  const borderStyle = showBorder ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}

  // Inline confirmation state replaces normal row content
  if (confirmOpen) {
    return (
      <div ref={setNodeRef} style={{ ...dndStyle, ...borderStyle }} className="flex items-center gap-2 py-[9px]">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="flex-shrink-0 cursor-grab touch-none p-0 bg-transparent border-0 inline-flex items-center justify-center"
          style={{ opacity: 0.3 }}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <div className="w-[18px] h-[18px] rounded-[4px] flex-shrink-0" style={{ border: '1.5px solid rgba(0,0,0,0.2)' }} aria-hidden />
        <span className="flex-1 text-item-label min-w-0 text-start line-through" style={{ color: '#9a9a9a' }}>
          {item.label}
        </span>
        <button
          type="button"
          onClick={cancelConfirm}
          className="flex-shrink-0 bg-transparent border-0 cursor-pointer px-1"
          style={{ fontSize: 12, color: '#6b6b6b' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirmRemove}
          className="flex-shrink-0 bg-transparent border-0 cursor-pointer px-1 font-medium"
          style={{ fontSize: 12, color: '#e24b4a' }}
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className="relative overflow-hidden"
      style={{ ...dndStyle, ...borderStyle }}
    >
      <div
        className="flex items-center gap-2 py-[9px] pr-1"
        style={{
          transform: swipeRevealed ? 'translateX(-56px)' : 'translateX(0)',
          transition: 'transform 200ms ease',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-content-hint p-0 bg-transparent border-0 inline-flex items-center justify-center"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} style={{ opacity: 0.3 }} />
        </button>
        <div
          className="w-[18px] h-[18px] rounded-[4px] flex-shrink-0"
          style={{ border: '1.5px solid rgba(0,0,0,0.2)' }}
          aria-hidden
        />
        {isEditingLabel ? (
          <input
            type="text"
            autoFocus
            value={editDraft}
            onChange={e => onEditDraftChange(e.target.value)}
            onBlur={() => {
              if (!editCancelRef.current) onEditCommit()
              editCancelRef.current = false
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { editCancelRef.current = false; e.currentTarget.blur() }
              if (e.key === 'Escape') onEditCancel(item.label)
            }}
            className="flex-1 min-w-0 text-item-label rounded-input border-0 outline-none px-1.5 py-0.5"
            style={{ background: '#f5f4f1', borderRadius: 8 }}
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={() => onStartEdit(item)}
            onKeyDown={e => e.key === 'Enter' && onStartEdit(item)}
            className="flex-1 text-item-label min-w-0 text-content-primary text-start cursor-text bg-transparent border-0 p-0"
          >
            {item.label}
          </span>
        )}
        {/* Desktop hover × */}
        <button
          type="button"
          onClick={openConfirm}
          aria-label="Remove item"
          className="flex-shrink-0 flex items-center justify-center bg-transparent border-0 cursor-pointer rounded"
          style={{
            width: 24, height: 24,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 120ms',
            color: '#9a9a9a',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e24b4a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9a9a9a' }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Mobile swipe-revealed red delete zone */}
      <button
        type="button"
        onClick={openConfirm}
        aria-label="Remove item"
        className="absolute top-0 right-0 bottom-0 flex items-center justify-center"
        style={{
          width: 56,
          backgroundColor: '#e24b4a',
          borderRadius: '0 8px 8px 0',
          border: 'none',
          cursor: 'pointer',
          opacity: swipeRevealed ? 1 : 0,
          pointerEvents: swipeRevealed ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      >
        <X size={16} color="white" strokeWidth={2.5} />
      </button>
    </div>
  )
}

export default function SectionCard({
  mode,
  section,
  variant,
  householdMembers,
  linkedTemplateId = null,
  workingTemplateId,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
  quickAddTripItem,
  quickAddTemplateItem,
  onToggleItem,
  onSaveToTemplate,
  onRemoveItem,
  onRemoveItemError,
  onDuplicateSection,
  onRenameSectionHeader,
  onRemoveSectionCard,
  onUpdateItemLabel,
}) {
  const [expanded, setExpanded] = useState(true)
  const [newItemIds, setNewItemIds] = useState(new Set())
  const [saveErrors, setSaveErrors] = useState({})
  const [sectionNameEditOpen, setSectionNameEditOpen] = useState(false)
  const [sectionNameDraft, setSectionNameDraft] = useState(section.name)
  const [addCategoryDraft, setAddCategoryDraft] = useState('')
  const [slot, setSlot] = useState(null)
  const [draftItem, setDraftItem] = useState('')
  const sectionNameCancelRef = useRef(false)
  const [renameCatId, setRenameCatId] = useState(null)
  const [renameCatDraft, setRenameCatDraft] = useState('')
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingItemDraft, setEditingItemDraft] = useState('')
  const itemEditCancelRef = useRef(false)

  const isTrip = mode === 'trip'

  useEffect(() => {
    setSectionNameDraft(section.name)
  }, [section.name])

  useEffect(() => {
    setSlot(null)
    setDraftItem('')
    setAddCategoryDraft('')
    setRenameCatId(null)
    setRenameCatDraft('')
  }, [section.id])

  const sortedSubs = useMemo(
    () =>
      [...(section.subcategories || [])].sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
      ),
    [section.subcategories],
  )

  const namedSubs = useMemo(
    () => sortedSubs.filter(s => !isDefaultBucketSubcategoryName(s.name)),
    [sortedSubs],
  )

  const defaultSubs = useMemo(
    () => sortedSubs.filter(s => isDefaultBucketSubcategoryName(s.name)),
    [sortedSubs],
  )

  const defaultSub = defaultSubs[0]
  const hasNamed = namedSubs.length > 0
  const isFlatBucketOnly = !hasNamed

  const defaultBucketItemCount =
    defaultSub && Array.isArray(defaultSub.items) ? defaultSub.items.length : 0
  const showMixedItemsHeading = hasNamed && defaultSub != null && defaultBucketItemCount > 0

  const { total: secTotal, checked: secChecked } = sectionItemTotals(section)

  const iconMeta = variant === 'shared' ? getSectionIconMeta(section.name) : null
  const SharedIc = iconMeta?.icon
  const displayMember =
    variant === 'person' ? resolveDisplayMember(section, householdMembers) : null

  const categoryLabelBase = marginTopPx => ({
    flex: '1 1 auto',
    minWidth: 0,
    margin: 0,
    padding: 0,
    fontSize: 12,
    fontWeight: 500,
    color: '#6b6b6b',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginTop: marginTopPx,
    marginBottom: 4,
  })

  const openAddCategorySlot = () => {
    setSlot('cat-add')
    setRenameCatId(null)
    setDraftItem('')
  }

  const closeSlotOnly = () => {
    setSlot(null)
    setDraftItem('')
  }

  const startItemEdit = item => {
    setEditingItemId(item.id)
    setEditingItemDraft(item.label)
    itemEditCancelRef.current = false
  }

  const commitItemEdit = async () => {
    if (itemEditCancelRef.current) { itemEditCancelRef.current = false; return }
    const trimmed = editingItemDraft.trim()
    if (!trimmed || !onUpdateItemLabel) { setEditingItemId(null); return }
    try {
      await onUpdateItemLabel(editingItemId, trimmed)
    } catch {
      window.alert('Could not rename item.')
    }
    setEditingItemId(null)
  }

  const cancelItemEdit = originalLabel => {
    itemEditCancelRef.current = true
    setEditingItemDraft(originalLabel)
    setEditingItemId(null)
  }

  const startCatTail = subId => {
    setSlot(`itemT:${subId}`)
    setRenameCatId(null)
    setDraftItem('')
  }

  const handleSaveTpl = async itemId => {
    if (!onSaveToTemplate) return
    try {
      setSaveErrors(e => ({ ...e, [itemId]: null }))
      await onSaveToTemplate(itemId)
    } catch {
      setSaveErrors(e => ({ ...e, [itemId]: true }))
    }
  }

  const submitItemDraft = async fromSlot => {
    const trimmed = draftItem.trim()
    if (!trimmed) return
    let newId = null
    if (isTrip) {
      if (fromSlot === 'item-flat') {
        newId = await quickAddTripItem(section.id, undefined, trimmed)
      } else if (typeof fromSlot === 'string' && fromSlot.startsWith('itemT:')) {
        const sid = fromSlot.slice('itemT:'.length)
        newId = await quickAddTripItem(section.id, sid, trimmed)
      }
    } else {
      const wt = workingTemplateId
      if (!wt) return
      if (fromSlot === 'item-flat') {
        newId = await quickAddTemplateItem(wt, section.id, undefined, trimmed)
      } else if (typeof fromSlot === 'string' && fromSlot.startsWith('itemT:')) {
        const sid = fromSlot.slice('itemT:'.length)
        newId = await quickAddTemplateItem(wt, section.id, sid, trimmed)
      }
    }
    if (newId) {
      setNewItemIds(prev => new Set([...prev, newId]))
      closeSlotOnly()
    }
  }

  const handleInlineAddCategory = async () => {
    const name = addCategoryDraft.trim()
    if (!name) return
    const id = await onAddCategory(section.id, name)
    if (id) {
      setAddCategoryDraft('')
      closeSlotOnly()
    }
  }

  const handleSaveRenameSectionHeader = async () => {
    const n = sectionNameDraft.trim()
    if (!n) return
    try {
      await onRenameSectionHeader(section.id, n)
      setSectionNameEditOpen(false)
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
      await onRemoveSectionCard(section.id)
    } catch {
      window.alert('Could not remove section.')
    }
  }

  const startRenameCat = sub => {
    setRenameCatId(sub.id)
    setRenameCatDraft(sub.name)
    closeSlotOnly()
  }

  const commitRenameCat = async sub => {
    const n = renameCatDraft.trim()
    if (!n || String(sub.name) === n) {
      setRenameCatId(null)
      return
    }
    try {
      await onRenameCategory(sub.id, n)
      setRenameCatId(null)
    } catch {
      window.alert('Could not rename label.')
      setRenameCatDraft(sub.name)
    }
  }

  const cancelRenameCat = sub => {
    setRenameCatId(null)
    setRenameCatDraft(sub.name)
  }

  const promptRemoveCat = async sub => {
    if (
      !window.confirm(
        `Remove ${sub.name} and its items?`,
      )
    ) {
      return
    }
    try {
      await onRemoveCategory(sub.id)
    } catch {
      window.alert('Could not remove.')
    }
  }

  const renderTripItemBlock = sub => {
    if (!sub?.id) return null
    const sortedItems = sortCategoryItems(sub.items)
    const itemIds = sortedItems.map(i => i.id)
    const canSaveToTpl = Boolean(isTrip && linkedTemplateId)

    const body =
      sortedItems.length === 0 ? (
        <SubcategoryEmptyDrop subId={sub.id}>{null}</SubcategoryEmptyDrop>
      ) : (
        <>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {sortedItems.map((item, index) => (
              <div key={item.id}>
                <SortableTripItemRow
                  item={item}
                  showBorder={index < sortedItems.length - 1}
                  isNew={newItemIds.has(item.id)}
                  canSaveToTemplate={canSaveToTpl}
                  onToggle={() => onToggleItem(item.id)}
                  onSave={() => handleSaveTpl(item.id)}
                  saveFailed={saveErrors[item.id]}
                  onDelete={() => onRemoveItem(item.id)}
                  onDeleteError={onRemoveItemError}
                  isEditingLabel={editingItemId === item.id}
                  editDraft={editingItemId === item.id ? editingItemDraft : ''}
                  onEditDraftChange={setEditingItemDraft}
                  onEditCommit={commitItemEdit}
                  onEditCancel={cancelItemEdit}
                  onStartEdit={startItemEdit}
                  editCancelRef={itemEditCancelRef}
                />
              </div>
            ))}
          </SortableContext>
          <SubcategoryTailDrop subId={sub.id} />
        </>
      )

    return body
  }

  const renderTemplateItemBlock = sub => {
    if (!sub?.id) return null
    const sortedItems = sortCategoryItems(sub.items)
    const itemIds = sortedItems.map(i => i.id)

    const body =
      sortedItems.length === 0 ? (
        <SubcategoryEmptyDrop subId={sub.id}>{null}</SubcategoryEmptyDrop>
      ) : (
        <>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {sortedItems.map((item, index) => (
              <SortableTemplateItemRow
                key={item.id}
                item={item}
                showBorder={index < sortedItems.length - 1}
                onRemove={() => onRemoveItem(item.id)}
                onRemoveError={onRemoveItemError}
                isEditingLabel={editingItemId === item.id}
                editDraft={editingItemId === item.id ? editingItemDraft : ''}
                onEditDraftChange={setEditingItemDraft}
                onEditCommit={commitItemEdit}
                onEditCancel={cancelItemEdit}
                onStartEdit={startItemEdit}
                editCancelRef={itemEditCancelRef}
              />
            ))}
          </SortableContext>
          <SubcategoryTailDrop subId={sub.id} />
        </>
      )
    return body
  }

  const renderSortableBlockByMode = sub => {
    return isTrip ? renderTripItemBlock(sub) : renderTemplateItemBlock(sub)
  }

  const renderTailItemRow = subId => {
    const tailKey = `itemT:${subId}`
    const open = slot === tailKey
    if (renameCatId != null) return null
    return (
      <div style={{ marginTop: open ? 6 : 8 }}>
        {!open ? (
          <button
            type="button"
            className="text-11 bg-transparent border-0 cursor-pointer p-0"
            style={SECTION_LINK_ACCENT}
            onClick={() => startCatTail(subId)}
          >
            + Add item
          </button>
        ) : (
          <SectionInlineShell>
            <input
              type="text"
              value={draftItem}
              onChange={e => setDraftItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitItemDraft(tailKey)
                if (e.key === 'Escape') closeSlotOnly()
              }}
              placeholder="Add item..."
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-13 text-content-primary px-1"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              onClick={() => submitItemDraft(tailKey)}
              className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 shrink-0"
            >
              Add
            </button>
            <button
              type="button"
              onClick={closeSlotOnly}
              className="flex-shrink-0 p-1 border-0 bg-transparent text-content-hint cursor-pointer inline-flex items-center justify-center"
              aria-label="Close"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </SectionInlineShell>
        )}
      </div>
    )
  }

  const renderFlatFooter = () => {
    const tailKey = 'item-flat'
    const open = slot === tailKey
    const blockEditing = renameCatId != null
    if (blockEditing) return null
    return (
      <div style={{ marginTop: open ? 6 : 8 }}>
        {!open ? (
          <button
            type="button"
            className="text-11 bg-transparent border-0 cursor-pointer p-0"
            style={SECTION_LINK_ACCENT}
            onClick={() => {
              setSlot(tailKey)
              setDraftItem('')
              setRenameCatId(null)
            }}
          >
            + Add item
          </button>
        ) : (
          <SectionInlineShell>
            <input
              type="text"
              value={draftItem}
              onChange={e => setDraftItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitItemDraft(tailKey)
                if (e.key === 'Escape') closeSlotOnly()
              }}
              placeholder="Add item..."
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-13 text-content-primary px-1"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              onClick={() => submitItemDraft(tailKey)}
              className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 shrink-0"
            >
              Add
            </button>
            <button
              type="button"
              onClick={closeSlotOnly}
              className="flex-shrink-0 p-1 border-0 bg-transparent text-content-hint cursor-pointer inline-flex items-center justify-center"
              aria-label="Close"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </SectionInlineShell>
        )}
      </div>
    )
  }

  const headerDividerStyle = expanded ? { borderBottom: '0.5px solid rgba(0,0,0,0.08)' } : {}

  const headerSecondary =
    isTrip ? `${secChecked}/${secTotal}` : `${secTotal} items`

  const renderCategoryLabelRow = (sub, opts) => {
    const mt = opts?.marginTopPx ?? 0
    const editingThis = renameCatId === sub.id

    return (
      <div
        key={`hdr-${sub.id}`}
        className="flex flex-wrap items-start gap-x-2 gap-y-1 w-full"
        style={{ marginBottom: editingThis ? 4 : undefined }}
      >
        {editingThis ? (
          <input
            type="text"
            value={renameCatDraft}
            onChange={e => setRenameCatDraft(e.target.value)}
            autoFocus
            className="flex-1 min-w-0 bg-white border border-[#e0ddd8] rounded-input px-2 py-1 text-13"
            style={{ ...categoryLabelBase(mt), flex: '1 1 10rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }}
            onBlur={() => commitRenameCat(sub)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.target.blur()
              }
              if (e.key === 'Escape') {
                cancelRenameCat(sub)
              }
            }}
          />
        ) : (
          <p className="leading-snug" style={categoryLabelBase(mt)}>
            {sub.name}
          </p>
        )}
        <span className="flex-1" />
        {!editingThis ? (
          <div className="flex items-center shrink-0" style={{ marginTop: mt > 0 ? 1 : -1 }}>
            <ActionMenu
              buttonSize={20}
              iconSize={14}
              buttonStyle={{ color: '#9a9a9a' }}
              items={[
                { label: 'Rename', onClick: () => startRenameCat(sub) },
                { label: 'Remove', onClick: () => promptRemoveCat(sub), danger: true },
              ]}
            />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-card mb-[10px] overflow-hidden"
      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={sectionNameEditOpen ? undefined : () => setExpanded(e => !e)}
        onKeyDown={e => {
          if (!sectionNameEditOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpanded(v => !v)
          }
        }}
        className={[
          'w-full flex items-center gap-2.5 px-[16px] py-[14px] text-start',
          sectionNameEditOpen ? '' : 'cursor-pointer',
        ].join(' ')}
        style={headerDividerStyle}
      >
        {variant === 'shared' && SharedIc ? (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: iconMeta.bg }}
          >
            <SharedIc size={16} style={{ color: iconMeta.color }} />
          </div>
        ) : (
          <Avatar member={displayMember} size={32} />
        )}

        {sectionNameEditOpen ? (
          <div
            className="flex-1 flex items-center gap-2 min-w-0"
            onClick={e => e.stopPropagation()}
          >
            <input
              type="text"
              autoFocus
              value={sectionNameDraft}
              onChange={e => setSectionNameDraft(e.target.value)}
              onBlur={() => {
                if (!sectionNameCancelRef.current) handleSaveRenameSectionHeader()
                sectionNameCancelRef.current = false
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  sectionNameCancelRef.current = false
                  e.currentTarget.blur()
                }
                if (e.key === 'Escape') {
                  sectionNameCancelRef.current = true
                  setSectionNameDraft(section.name)
                  setSectionNameEditOpen(false)
                }
              }}
              className="flex-1 min-w-0 text-14 rounded-input px-2 py-1 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
            />
            <button
              type="button"
              onPointerDown={() => { sectionNameCancelRef.current = true }}
              onClick={() => { setSectionNameDraft(section.name); setSectionNameEditOpen(false) }}
              className="text-12 text-content-secondary bg-transparent border-0 cursor-pointer p-0 shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className="text-14 font-medium text-content-primary text-start shrink-0 max-w-[38%] truncate">
              {section.name}
            </span>
            <ActionMenu
              buttonSize={28}
              iconSize={16}
              buttonStyle={{ color: '#6b6b6b' }}
              items={[
                {
                  label: 'Add category',
                  onClick: () => {
                    if (slot === 'cat-add') closeSlotOnly()
                    else { setExpanded(true); openAddCategorySlot() }
                  },
                },
                { label: 'Rename', onClick: () => setSectionNameEditOpen(true) },
                ...(!isTrip && onDuplicateSection
                  ? [{ label: 'Duplicate section', onClick: () => onDuplicateSection(section.id) }]
                  : []),
                { label: 'Remove', onClick: handleRemoveSection, danger: true },
              ]}
            />
            <span className="flex-1 min-w-2" />
          </>
        )}

        <span className="text-12 text-content-secondary whitespace-nowrap me-1">
          {headerSecondary}
        </span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-content-hint"
          style={{
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>

      {slot === 'cat-add' ? (
        <div className="px-[16px] py-2" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <SectionInlineShell style={{ marginBottom: 0 }}>
            <input
              type="text"
              value={addCategoryDraft}
              onChange={e => setAddCategoryDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleInlineAddCategory()
                if (e.key === 'Escape') closeSlotOnly()
              }}
              placeholder="Category name..."
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-13 text-content-primary px-1"
              autoFocus
            />
            <button
              type="button"
              onClick={handleInlineAddCategory}
              className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 shrink-0"
            >
              Add
            </button>
            <button
              type="button"
              onClick={closeSlotOnly}
              className="flex-shrink-0 p-1 border-0 bg-transparent text-content-hint cursor-pointer inline-flex items-center justify-center"
              aria-label="Close adding category"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </SectionInlineShell>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          transition: 'grid-template-rows 250ms ease',
          gridTemplateRows: expanded ? '1fr' : '0fr',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="px-[16px] pt-[12px] pb-[14px]">
            {isFlatBucketOnly ? (
              <>
                {defaultSub ? renderSortableBlockByMode(defaultSub) : null}
                <div
                  style={{
                    marginTop: defaultSub ? 10 : 0,
                    paddingTop: defaultSub ? 10 : 0,
                    borderTop: defaultSub ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                  }}
                >
                  {!renameCatId ? renderFlatFooter() : null}
                </div>
              </>
            ) : (
              <>
                {namedSubs.map((sub, idx) => (
                  <div key={sub.id}>
                    <div>{renderCategoryLabelRow(sub, { marginTopPx: idx === 0 ? 0 : 12 })}</div>
                    {renameCatId !== sub.id ? renderSortableBlockByMode(sub) : null}
                    {!renameCatId ? renderTailItemRow(sub.id) : null}
                  </div>
                ))}
                {defaultSub ? (
                  <div key={defaultSub.id}>
                    {showMixedItemsHeading ? (
                      <p style={categoryLabelBase(namedSubs.length ? 12 : 0)}>Items</p>
                    ) : null}
                    {renameCatId !== defaultSub.id ? renderSortableBlockByMode(defaultSub) : null}
                    {!renameCatId ? renderTailItemRow(defaultSub.id) : null}
                  </div>
                ) : !renameCatId ? (
                  <div
                    style={{
                      marginTop: namedSubs.length ? 12 : 0,
                      paddingTop: 10,
                      borderTop: '0.5px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    {renderFlatFooter()}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
