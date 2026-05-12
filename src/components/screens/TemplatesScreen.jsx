import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  closestCenter,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { ArrowLeft, ChevronDown, ChevronUp, Plane, Car, Moon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  ensureTemplateHasMinimalTree,
  ensureTemplateMiscSectionDefaultSubcategory,
  DEFAULT_BUCKET_SUBCATEGORY_NAME,
  isDefaultBucketSubcategoryName,
} from '../../lib/templateLayout'
import { asArray } from '../../lib/transforms'
import SectionCard from '../ui/SectionCard'

const ICON_MAP = { Plane, Car, Moon }

const TEMPLATE_DETAIL_SELECT = `
  id, name, icon,
  template_sections(
    id, section_type, name, member_id, sort_order,
    template_subcategories(
      id, name, sort_order,
      template_items(id, label, sort_order)
    )
  )
`

function normalizeTemplateRow(t) {
  const secs = [...asArray(t.template_sections)]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(sec => ({
      ...sec,
      template_subcategories: [...asArray(sec.template_subcategories)]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(sub => ({
          ...sub,
          template_items: [...asArray(sub.template_items)].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
          ),
        })),
    }))
  return { ...t, template_sections: secs }
}

function countTemplateItems(tpl) {
  let n = 0
  for (const sec of tpl.template_sections || []) {
    n += countTemplateSectionItems(sec)
  }
  return n
}

function countTemplateSectionItems(sec) {
  let n = 0
  for (const sub of sec.template_subcategories || []) {
    n += asArray(sub.template_items).length
  }
  return n
}

/** Shape SectionCard expects (camelCase), from a DB template_sections row */
function mapTemplateSectionForCard(sec, householdMembers) {
  const subs = [...asArray(sec.template_subcategories)].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  return {
    id: sec.id,
    name: sec.name,
    sectionType: sec.section_type,
    memberId: sec.member_id,
    member:
      sec.section_type === 'person'
        ? householdMembers.find(m => m.id === sec.member_id) ?? null
        : null,
    sortOrder: sec.sort_order,
    subcategories: subs.map(sub => ({
      id: sub.id,
      name: sub.name,
      sortOrder: sub.sort_order,
      items: [...asArray(sub.template_items)]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(it => ({
          id: it.id,
          label: it.label,
          sortOrder: it.sort_order,
          checked: false,
          isManuallyAdded: true,
          savedToTemplate: false,
        })),
    })),
  }
}
export default function TemplatesScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [editingNameId, setEditingNameId] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [members, setMembers] = useState([])
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [addSectionTab, setAddSectionTab] = useState('shared')
  const [tplSharedSectionName, setTplSharedSectionName] = useState('')
  const [tplPersonMemberId, setTplPersonMemberId] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    if (!household?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select(
        `
        id, name, icon,
        template_sections(
          id, section_type, name, member_id, sort_order,
          template_subcategories(
            id, name, sort_order,
            template_items(id, label, sort_order)
          )
        )
      `,
      )
      .eq('household_id', household.id)
      .order('created_at')

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const raw = Array.isArray(data) ? data : []
    const sorted = raw.map(normalizeTemplateRow)
    setRows(sorted)
    setLoading(false)
  }, [household?.id])

  const mergeTemplateRow = useCallback(
    async templateId => {
      if (!household?.id || !templateId) return
      const { data, error } = await supabase
        .from('templates')
        .select(TEMPLATE_DETAIL_SELECT)
        .eq('id', templateId)
        .eq('household_id', household.id)
        .maybeSingle()
      if (error) {
        alert(error.message)
        return
      }
      if (data) setRows(prev => prev.map(r => (r.id === templateId ? normalizeTemplateRow(data) : r)))
    },
    [household?.id],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household?.id) {
      setMembers([])
      return
    }
    let cancelled = false
    supabase
      .from('household_members')
      .select('id, name, role')
      .eq('household_id', household.id)
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error(error)
          return
        }
        setMembers(Array.isArray(data) ? data : [])
      })
    return () => {
      cancelled = true
    }
  }, [household?.id])

  useEffect(() => {
    setTplSharedSectionName('')
    setTplPersonMemberId('')
    setAddSectionOpen(false)
    setAddSectionTab('shared')
  }, [openId])

  useEffect(() => {
    if (!openId || !household?.id) return
    const tpl = rows.find(r => r.id === openId)
    if (!tpl) return
    const hasNoSections = !(tpl.template_sections || []).length
    if (!hasNoSections) return

    let cancelled = false
    ;(async () => {
      try {
        const created = await ensureTemplateHasMinimalTree(supabase, openId)
        if (!cancelled && created) await mergeTemplateRow(openId)
      } catch (e) {
        if (!cancelled) alert(e?.message || 'Could not prepare template.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openId, rows, household?.id, mergeTemplateRow])

  async function saveTemplateName(id) {
    const name = editNameValue.trim()
    if (!name) return
    const { error } = await supabase.from('templates').update({ name }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setEditingNameId(null)
    await mergeTemplateRow(id)
  }

  async function resolveTemplateItemBucketId(templateId, targetSectionId, preferredSubcategoryId) {
    if (!targetSectionId?.trim()) {
      return ensureTemplateMiscSectionDefaultSubcategory(supabase, templateId)
    }
    const sectionId = String(targetSectionId).trim()
    if (preferredSubcategoryId?.trim()) {
      const sid = String(preferredSubcategoryId).trim().replace(/^:+/, '')
      if (sid) {
        const { data: row, error: vErr } = await supabase
          .from('template_subcategories')
          .select('id')
          .eq('id', sid)
          .eq('section_id', sectionId)
          .maybeSingle()
        if (vErr) throw vErr
        if (row?.id) return row.id
      }
    }

    const { data: allSubs, error: qErr } = await supabase
      .from('template_subcategories')
      .select('id, name, sort_order')
      .eq('section_id', sectionId)
      .order('sort_order', { ascending: true })

    if (qErr) throw qErr
    const list = allSubs || []

    const bucket = list.find(s => isDefaultBucketSubcategoryName(s.name))
    if (bucket) return bucket.id

    const maxSo = list.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)

    const { data: newSub, error: insErr } = await supabase
      .from('template_subcategories')
      .insert({
        section_id: sectionId,
        name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
        sort_order: list.length === 0 ? 0 : maxSo + 1,
      })
      .select('id')
      .single()

    if (insErr) throw insErr
    return newSub.id
  }

  const appendTemplateItem = useCallback(
    async (templateId, sectionId, preferredSubcategoryId, label) => {
      const trimmed = String(label || '').trim()
      if (!trimmed || !templateId || !sectionId) return null
      let subId
      try {
        subId = await resolveTemplateItemBucketId(
          templateId,
          sectionId,
          preferredSubcategoryId?.trim() ? preferredSubcategoryId : undefined,
        )
      } catch (e) {
        alert(e?.message || 'Could not add item.')
        return null
      }
      const { data: maxRows, error: maxErr } = await supabase
        .from('template_items')
        .select('sort_order')
        .eq('subcategory_id', subId)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (maxErr) {
        alert(maxErr.message)
        return null
      }
      const maxOrder = maxRows?.[0]?.sort_order ?? 0

      const { data: ins, error } = await supabase
        .from('template_items')
        .insert({
          subcategory_id: subId,
          label: trimmed,
          sort_order: maxOrder + 1,
        })
        .select('id')
        .single()

      if (error) {
        alert(error.message)
        return null
      }
      await mergeTemplateRow(templateId)
      return ins?.id ?? null
    },
    [mergeTemplateRow],
  )

  async function addTemplateCategory(sectionId, name) {
    const trimmed = String(name || '').trim()
    if (!trimmed || !openId) return null
    const tpl = rows.find(r => r.id === openId)
    const sec = tpl?.template_sections?.find(s => s.id === sectionId)
    if (!sec) return null
    const subs = asArray(sec.template_subcategories)
    const maxSo = subs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { data, error } = await supabase
      .from('template_subcategories')
      .insert({
        section_id: sectionId,
        name: trimmed,
        sort_order: maxSo + 1,
      })
      .select('id')
      .single()
    if (error) {
      alert(error.message)
      return null
    }
    await mergeTemplateRow(openId)
    return data?.id ?? null
  }

  async function renameTemplateCategoryRow(categoryId, newName) {
    const trimmed = String(newName || '').trim()
    if (!trimmed) return
    const { error } = await supabase
      .from('template_subcategories')
      .update({ name: trimmed })
      .eq('id', categoryId)
    if (error) {
      alert(error.message)
      throw error
    }
    await mergeTemplateRow(openId)
  }

  async function removeTemplateCategoryRow(categoryId) {
    const { error } = await supabase.from('template_subcategories').delete().eq('id', categoryId)
    if (error) {
      alert(error.message)
      throw error
    }
    await mergeTemplateRow(openId)
  }

  async function updateTemplateSectionName(sectionId, name) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    const { error } = await supabase.from('template_sections').update({ name: trimmed }).eq('id', sectionId)
    if (error) {
      alert(error.message)
      throw error
    }
    await mergeTemplateRow(openId)
  }

  async function addEmptySharedTemplateSection(templateId) {
    const name = tplSharedSectionName.trim()
    if (!name) return
    const tpl = rows.find(r => r.id === templateId)
    const secs = tpl?.template_sections || []
    const maxSo = secs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_sections').insert({
      template_id: templateId,
      section_type: 'shared',
      name,
      member_id: null,
      sort_order: maxSo + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setTplSharedSectionName('')
    await mergeTemplateRow(templateId)
  }

  async function addEmptyPersonTemplateSection(templateId) {
    if (!tplPersonMemberId) {
      alert('Select a household member who is not already in this template.')
      return
    }
    const m = members.find(x => x.id === tplPersonMemberId)
    const name = m?.name?.trim()
    if (!name) return
    const tpl = rows.find(r => r.id === templateId)
    if (tpl?.template_sections?.some(s => s.section_type === 'person' && s.member_id === tplPersonMemberId)) {
      alert('This person already has a section in this template.')
      return
    }
    const secs = tpl?.template_sections || []
    const maxSo = secs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_sections').insert({
      template_id: templateId,
      section_type: 'person',
      name,
      member_id: tplPersonMemberId,
      sort_order: maxSo + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setTplPersonMemberId('')
    await mergeTemplateRow(templateId)
  }

  async function removeTemplateSection(sec) {
    const n = countTemplateSectionItems(sec)
    if (!window.confirm(`Remove section "${sec.name}" and all items inside (${n} total)?`)) return
    const { error } = await supabase.from('template_sections').delete().eq('id', sec.id)
    if (error) {
      alert(error.message)
      return
    }
    await mergeTemplateRow(openId)
  }

  async function removeTemplateSectionById(sectionId) {
    const tpl = rows.find(r => r.id === openId)
    const sec = tpl?.template_sections?.find(s => s.id === sectionId)
    if (sec) await removeTemplateSection(sec)
  }

  async function removeTemplateItem(itemId) {
    const { error } = await supabase.from('template_items').delete().eq('id', itemId)
    if (error) {
      alert(error.message)
      return
    }
    await mergeTemplateRow(openId)
  }

  const reorderTemplateItems = useCallback(async (_subcategoryId, orderedIds, templateId) => {
    if (!orderedIds.length || !templateId) return
    const results = await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('template_items').update({ sort_order: (idx + 1) * 10 }).eq('id', id),
      ),
    )
    const failed = results.find(r => r.error)
    if (failed?.error) {
      alert(failed.error.message)
      return
    }
    await mergeTemplateRow(templateId)
  }, [mergeTemplateRow])

  const sortTemplateItemIdsForSub = useCallback((tpl, subId) => {
    const sid = String(subId)
    for (const sec of tpl.template_sections || []) {
      for (const sub of sec.template_subcategories || []) {
        if (String(sub.id) !== sid) continue
        return [...asArray(sub.template_items)]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(i => i.id)
      }
    }
    return []
  }, [])

  const findTemplateItemSubcategoryId = useCallback((tpl, itemId) => {
    const iid = String(itemId)
    for (const sec of tpl.template_sections || []) {
      for (const sub of sec.template_subcategories || []) {
        const sorted = [...asArray(sub.template_items)].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
        if (sorted.some(it => String(it.id) === iid)) return sub.id
      }
    }
    return null
  }, [])

  const moveTemplateItem = useCallback(
    async (tpl, activeId, overId) => {
      const templateId = tpl.id
      const aid = String(activeId)
      const oid = String(overId)
      if (aid === oid) return

      const sourceSubId = findTemplateItemSubcategoryId(tpl, aid)
      if (sourceSubId == null) return

      const sortIdsForSub = sid => sortTemplateItemIdsForSub(tpl, sid)

      let targetSubId
      let insertMode
      if (oid.startsWith('drop-end:')) {
        targetSubId = oid.slice('drop-end:'.length)
        insertMode = 'append'
      } else if (oid.startsWith('drop:')) {
        targetSubId = oid.slice('drop:'.length)
        insertMode = 'empty'
      } else {
        const overSub = findTemplateItemSubcategoryId(tpl, oid)
        if (overSub == null) return
        targetSubId = overSub
        insertMode = 'before_item'
      }

      const sourceSubStr = String(sourceSubId)
      const targetSubStr = String(targetSubId)

      if (sourceSubStr === targetSubStr) {
        if (insertMode === 'append') {
          const ids = sortIdsForSub(sourceSubId)
          const oldIndex = ids.findIndex(id => String(id) === aid)
          if (oldIndex < 0) return
          const newIds = [...ids.filter(id => String(id) !== aid), aid]
          await reorderTemplateItems(sourceSubId, newIds, templateId)
          return
        }
        if (insertMode === 'empty') return
        const ids = sortIdsForSub(sourceSubId)
        const oldIndex = ids.findIndex(id => String(id) === aid)
        const newIndex = ids.findIndex(id => String(id) === oid)
        if (oldIndex < 0 || newIndex < 0) return
        await reorderTemplateItems(sourceSubId, arrayMove(ids, oldIndex, newIndex), templateId)
        return
      }

      const sourceIds = sortIdsForSub(sourceSubId).filter(id => String(id) !== aid)
      let targetIds = sortIdsForSub(targetSubId).filter(id => String(id) !== aid)

      let insertIndex
      if (insertMode === 'append') {
        insertIndex = targetIds.length
      } else if (insertMode === 'empty') {
        insertIndex = 0
      } else {
        insertIndex = targetIds.findIndex(id => String(id) === oid)
        if (insertIndex < 0) insertIndex = targetIds.length
      }

      const newTargetIds = [...targetIds.slice(0, insertIndex), aid, ...targetIds.slice(insertIndex)]

      const updates = []
      for (let i = 0; i < sourceIds.length; i++) {
        updates.push(
          supabase
            .from('template_items')
            .update({ sort_order: (i + 1) * 10, subcategory_id: sourceSubId })
            .eq('id', sourceIds[i]),
        )
      }
      for (let i = 0; i < newTargetIds.length; i++) {
        updates.push(
          supabase
            .from('template_items')
            .update({ sort_order: (i + 1) * 10, subcategory_id: targetSubId })
            .eq('id', newTargetIds[i]),
        )
      }
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) {
        alert(failed.error.message)
        return
      }
      await mergeTemplateRow(templateId)
    },
    [findTemplateItemSubcategoryId, mergeTemplateRow, reorderTemplateItems, sortTemplateItemIdsForSub],
  )

  function handleTemplateDragEnd(tpl, event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    moveTemplateItem(tpl, active.id, over.id)
  }

  return (
    <div className="bg-page h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden">
      <div className="flex-none flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={() => navigate('/settings', { state: { direction: 'back' } })}
          className="flex items-center gap-1 text-13"
          style={{ color: '#2d6fb5' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-18 font-medium text-content-primary">Pack templates</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-8">
        <p className="text-12 text-content-secondary mb-4">
          Sections are the top level of each template (shared groups and one card per traveller). Category labels
          group items inside each section. Trips copy this structure when you create them.
        </p>

        {loading ? (
          <p className="text-13 text-content-hint animate-pulse">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-13 text-content-hint">No templates yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(tpl => {
              const Icon = ICON_MAP[tpl.icon] || Plane
              const expanded = openId === tpl.id
              const itemTotal = countTemplateItems(tpl)

              return (
                <div
                  key={tpl.id}
                  className="bg-white rounded-card overflow-hidden"
                  style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : tpl.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left"
                  >
                    <div
                      className="rounded-input flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, backgroundColor: '#f1efe8', color: '#6b6b6b' }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-14 font-medium text-content-primary truncate">{tpl.name}</p>
                      <p className="text-11 text-content-secondary">{itemTotal} items</p>
                    </div>
                    {expanded ? (
                      <ChevronUp size={18} className="text-content-hint" />
                    ) : (
                      <ChevronDown size={18} className="text-content-hint" />
                    )}
                  </button>

                  {expanded && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={e => handleTemplateDragEnd(tpl, e)}
                    >
                    <div className="px-3 pb-3 border-t border-[rgba(0,0,0,0.06)] pt-3 space-y-4">
                      {editingNameId === tpl.id ? (
                        <div className="flex gap-2">
                          <input
                            value={editNameValue}
                            onChange={e => setEditNameValue(e.target.value)}
                            className="flex-1 rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13"
                          />
                          <button
                            type="button"
                            onClick={() => saveTemplateName(tpl.id)}
                            className="text-12 bg-navy text-white rounded-input px-3"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNameId(null)}
                            className="text-12 text-content-secondary px-2"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNameId(tpl.id)
                            setEditNameValue(tpl.name)
                          }}
                          className="text-12"
                          style={{ color: '#2d6fb5' }}
                        >
                          Rename template
                        </button>
                      )}

                      {(() => {
                        const usedMemberIds = new Set()
                        for (const s of tpl.template_sections || []) {
                          if (s.section_type === 'person' && s.member_id) {
                            usedMemberIds.add(s.member_id)
                          }
                        }
                        const availableForPerson = members.filter(m => !usedMemberIds.has(m.id))
                        const sortedSections = [...(tpl.template_sections || [])].sort(
                          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                        )
                        return (
                          <>
                            {sortedSections.map(sec => (
                              <SectionCard
                                key={sec.id}
                                mode="template"
                                workingTemplateId={tpl.id}
                                section={mapTemplateSectionForCard(sec, members)}
                                variant={sec.section_type === 'shared' ? 'shared' : 'person'}
                                householdMembers={members}
                                onAddCategory={addTemplateCategory}
                                onRenameCategory={renameTemplateCategoryRow}
                                onRemoveCategory={removeTemplateCategoryRow}
                                quickAddTemplateItem={appendTemplateItem}
                                onRemoveItem={removeTemplateItem}
                                onRenameSectionHeader={updateTemplateSectionName}
                                onRemoveSectionCard={removeTemplateSectionById}
                              />
                            ))}

                            <div
                              className="bg-white rounded-card overflow-hidden"
                              style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                            >
                              <button
                                type="button"
                                onClick={() => setAddSectionOpen(o => !o)}
                                aria-expanded={addSectionOpen}
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
                                    transform: addSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                  }}
                                />
                              </button>
                              <div
                                style={{
                                  display: 'grid',
                                  transition: 'grid-template-rows 250ms ease',
                                  gridTemplateRows: addSectionOpen ? '1fr' : '0fr',
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
                                        onClick={() => setAddSectionTab('shared')}
                                        className="text-12 font-medium rounded-input px-3 py-1.5 border border-transparent"
                                        style={
                                          addSectionTab === 'shared'
                                            ? {
                                                backgroundColor: '#fff',
                                                borderColor: '#e0ddd8',
                                                color: '#1a1a1a',
                                              }
                                            : { backgroundColor: 'transparent', color: '#6b6b6b' }
                                        }
                                      >
                                        Shared section
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAddSectionTab('person')}
                                        className="text-12 font-medium rounded-input px-3 py-1.5 border border-transparent"
                                        style={
                                          addSectionTab === 'person'
                                            ? {
                                                backgroundColor: '#fff',
                                                borderColor: '#e0ddd8',
                                                color: '#1a1a1a',
                                              }
                                            : { backgroundColor: 'transparent', color: '#6b6b6b' }
                                        }
                                      >
                                        Person section
                                      </button>
                                    </div>

                                    {addSectionTab === 'shared' ? (
                                      <div className="space-y-3">
                                        <input
                                          type="text"
                                          value={tplSharedSectionName}
                                          onChange={e => setTplSharedSectionName(e.target.value)}
                                          onKeyDown={e =>
                                            e.key === 'Enter' && addEmptySharedTemplateSection(tpl.id)
                                          }
                                          placeholder="Section name (e.g. Health, Snacks)"
                                          className="w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => addEmptySharedTemplateSection(tpl.id)}
                                          className="w-full text-12 font-medium text-white bg-navy hover:bg-navy-hover rounded-input px-3 py-2.5"
                                        >
                                          + Add section
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <select
                                          value={tplPersonMemberId}
                                          onChange={e => setTplPersonMemberId(e.target.value)}
                                          disabled={availableForPerson.length === 0}
                                          className={`w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy${
                                            availableForPerson.length === 0 ? ' opacity-60 cursor-not-allowed' : ''
                                          }`}
                                        >
                                          <option value="">
                                            {availableForPerson.length === 0
                                              ? 'Everyone already has a section'
                                              : 'Select household member…'}
                                          </option>
                                          {availableForPerson.map(m => (
                                            <option key={m.id} value={m.id}>
                                              {m.name}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => addEmptyPersonTemplateSection(tpl.id)}
                                          disabled={availableForPerson.length === 0}
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
                          </>
                        )
                      })()}
                    </div>
                    </DndContext>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
