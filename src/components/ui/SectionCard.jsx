import { useState, useEffect, useMemo, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, GripVertical, Check, BookmarkPlus, X } from 'lucide-react'
import Avatar from './Avatar'
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

/** Trip checklist row (checkbox, save-to-template, long-press delete) */
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
  activatorRef,
  dragAttributes,
  dragListeners,
}) {
  const showSaveToTemplate = Boolean(
    canSaveToTemplate && !item.savedToTemplate && item.isManuallyAdded,
  )
  const canDelete = Boolean(item.isManuallyAdded)
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
        className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer checkbox-interactive"
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

/** Template editing row — visual checkbox stub, gripped reorder, × remove */
function SortableTemplateItemRow({ item, showBorder, onRemove }) {
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
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      className={['flex items-center gap-2 py-[9px] list-none', !showBorder ? '' : ''].join(' ')}
      style={{
        ...dndStyle,
        ...(showBorder ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}),
      }}
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
      <span className="flex-1 text-13 min-w-0 text-content-primary text-left">{item.label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-11 text-content-hint bg-transparent border-0 cursor-pointer p-0 flex-shrink-0 leading-none hover:text-[#c03434]"
        aria-label="Remove item"
      >
        ×
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
  onRenameSectionHeader,
  onRemoveSectionCard,
}) {
  const [expanded, setExpanded] = useState(true)
  const [newItemIds, setNewItemIds] = useState(new Set())
  const [saveErrors, setSaveErrors] = useState({})
  const [sectionNameEditOpen, setSectionNameEditOpen] = useState(false)
  const [sectionNameDraft, setSectionNameDraft] = useState(section.name)
  const [addCategoryDraft, setAddCategoryDraft] = useState('')
  const [slot, setSlot] = useState(null)
  const [draftItem, setDraftItem] = useState('')
  const [renameCatId, setRenameCatId] = useState(null)
  const [renameCatDraft, setRenameCatDraft] = useState('')

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
    fontSize: 10,
    fontWeight: 500,
    color: '#6b6b6b',
    letterSpacing: '0.07em',
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
          <div className="flex items-center gap-2 shrink-0" style={{ marginTop: mt > 0 ? 1 : -1 }}>
            <button
              type="button"
              className="text-11 bg-transparent border-0 cursor-pointer p-0"
              style={SECTION_LINK_ACCENT}
              onClick={() => startRenameCat(sub)}
            >
              Rename
            </button>
            <button
              type="button"
              className="group text-11 bg-transparent border-0 cursor-pointer p-0 hover:text-[#c03434]"
              style={{ color: '#6b6b6b' }}
              onClick={() => promptRemoveCat(sub)}
            >
              Remove
            </button>
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
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(v => !v)
          }
        }}
        className="w-full flex items-center gap-2.5 px-[14px] py-[13px] cursor-pointer text-left"
        style={headerDividerStyle}
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
        <span className="text-14 font-medium text-content-primary text-left shrink-0 max-w-[38%] truncate">
          {section.name}
        </span>
        <button
          type="button"
          className="text-11 bg-transparent border-0 cursor-pointer p-0 shrink-0"
          style={SECTION_LINK_ACCENT}
          onClick={e => {
            e.stopPropagation()
            if (slot === 'cat-add') closeSlotOnly()
            else openAddCategorySlot()
          }}
        >
          + Add category
        </button>
        <span className="flex-1 min-w-2" />
        <span className="text-12 text-content-secondary whitespace-nowrap mr-1">
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
        <div className="px-[14px] py-2" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
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
          <div className="px-[14px] pt-2 pb-1 flex flex-wrap items-center justify-end gap-2 border-b border-[rgba(0,0,0,0.06)]">
            {sectionNameEditOpen ? (
              <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0">
                <input
                  type="text"
                  value={sectionNameDraft}
                  onChange={e => setSectionNameDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveRenameSectionHeader()}
                  className="flex-1 min-w-[8rem] text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                />
                <button
                  type="button"
                  onClick={handleSaveRenameSectionHeader}
                  className="text-12 font-medium text-navy bg-transparent border-0 cursor-pointer p-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSectionNameDraft(section.name)
                    setSectionNameEditOpen(false)
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
                  onClick={() => setSectionNameEditOpen(true)}
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

          <div className="px-[14px] pt-[11px] pb-[13px]">
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
