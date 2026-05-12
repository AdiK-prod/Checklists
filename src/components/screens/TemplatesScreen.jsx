import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ChevronDown, ChevronUp, GripVertical, Plus, Plane, Car, Moon, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  ensureTemplateHasMinimalTree,
  ensureTemplateMiscSectionDefaultSubcategory,
  DEFAULT_BUCKET_SUBCATEGORY_NAME,
  isDefaultBucketSubcategoryName,
  isMiscSectionName,
} from '../../lib/templateLayout'
import { asArray } from '../../lib/transforms'

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

export default function TemplatesScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const [addTargetSectionId, setAddTargetSectionId] = useState('')
  const [addTargetSubcategoryId, setAddTargetSubcategoryId] = useState('')
  const [editingNameId, setEditingNameId] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [members, setMembers] = useState([])
  const [editingTplSectionId, setEditingTplSectionId] = useState(null)
  const [tplSectionEditName, setTplSectionEditName] = useState('')
  const [newSharedCatName, setNewSharedCatName] = useState('')
  const [newPersonMemberId, setNewPersonMemberId] = useState('')
  const [newPersonCatName, setNewPersonCatName] = useState('')
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [tplCategoryDraftBySection, setTplCategoryDraftBySection] = useState({})
  const [tplAddCategoryOpenSectionId, setTplAddCategoryOpenSectionId] = useState(null)

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
    setAddTargetSectionId('')
    setAddTargetSubcategoryId('')
    setTplCategoryDraftBySection({})
    setNewSharedCatName('')
    setNewPersonMemberId('')
    setNewPersonCatName('')
    setEditingTplSectionId(null)
    setTplSectionEditName('')
    setAddCategoryOpen(false)
    setTplAddCategoryOpenSectionId(null)
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

  useEffect(() => {
    if (!openId || !addTargetSectionId) {
      setAddTargetSubcategoryId('')
      return
    }
    const tpl = rows.find(r => r.id === openId)
    const sec = tpl?.template_sections?.find(s => String(s.id) === String(addTargetSectionId))
    const subs = [...asArray(sec?.template_subcategories)].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    setAddTargetSubcategoryId(prev => {
      if (!prev) return ''
      const ok = subs.some(s => String(s.id) === String(prev))
      return ok ? prev : ''
    })
  }, [openId, rows, addTargetSectionId])

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
      const sid = String(preferredSubcategoryId).trim()
      const { data: row, error: vErr } = await supabase
        .from('template_subcategories')
        .select('id')
        .eq('id', sid)
        .eq('section_id', sectionId)
        .maybeSingle()
      if (vErr) throw vErr
      if (row?.id) return row.id
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

  async function addItem(templateId) {
    const label = newLabel.trim()
    if (!label) return

    let subId
    try {
      subId = await resolveTemplateItemBucketId(
        templateId,
        addTargetSectionId,
        addTargetSubcategoryId,
      )
    } catch (e) {
      alert(e?.message || 'Could not add item to the template.')
      return
    }

    const { data: maxRows, error: maxErr } = await supabase
      .from('template_items')
      .select('sort_order')
      .eq('subcategory_id', subId)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (maxErr) {
      alert(maxErr.message)
      return
    }
    const maxOrder = maxRows?.[0]?.sort_order ?? 0

    const { error } = await supabase.from('template_items').insert({
      subcategory_id: subId,
      label,
      sort_order: maxOrder + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setNewLabel('')
    await mergeTemplateRow(templateId)
  }

  async function addTemplateSharedCategory(templateId) {
    const name = newSharedCatName.trim()
    if (!name) return
    const tpl = rows.find(r => r.id === templateId)
    const secs = tpl?.template_sections || []
    const maxSo = secs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { data: secRow, error } = await supabase
      .from('template_sections')
      .insert({
        template_id: templateId,
        section_type: 'shared',
        name,
        member_id: null,
        sort_order: maxSo + 1,
      })
      .select('id')
      .single()
    if (error) {
      alert(error.message)
      return
    }
    setNewSharedCatName('')
    await mergeTemplateRow(templateId)
  }

  async function addTemplatePersonCategory(templateId) {
    const memberId = newPersonMemberId
    if (!memberId) {
      alert('Select a household member.')
      return
    }
    const tpl = rows.find(r => r.id === templateId)
    const name =
      newPersonCatName.trim() || members.find(m => m.id === memberId)?.name || ''
    if (!name) return
    if (tpl?.template_sections?.some(s => s.section_type === 'person' && s.member_id === memberId)) {
      alert('This person already has a section in this template.')
      return
    }
    const secs = tpl?.template_sections || []
    const maxSo = secs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { data: secRow, error } = await supabase
      .from('template_sections')
      .insert({
        template_id: templateId,
        section_type: 'person',
        name,
        member_id: memberId,
        sort_order: maxSo + 1,
      })
      .select('id')
      .single()
    if (error) {
      alert(error.message)
      return
    }
    setNewPersonCatName('')
    setNewPersonMemberId('')
    await mergeTemplateRow(templateId)
  }

  async function saveTplSectionName(sectionId) {
    const name = tplSectionEditName.trim()
    if (!name) return
    const { error } = await supabase.from('template_sections').update({ name }).eq('id', sectionId)
    if (error) {
      alert(error.message)
      return
    }
    setEditingTplSectionId(null)
    await mergeTemplateRow(openId)
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

  async function removeTemplateCategory(sub, sec) {
    const n = asArray(sub.template_items).length
    if (!window.confirm(`Remove category "${sub.name}" and all ${n} item(s) inside?`)) return
    const { error } = await supabase.from('template_subcategories').delete().eq('id', sub.id)
    if (error) {
      alert(error.message)
      return
    }
    await mergeTemplateRow(openId)
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

  async function addTemplateCategoryRow(sectionId, templateId) {
    const name = (tplCategoryDraftBySection[sectionId] || '').trim()
    if (!name) return
    const tpl = rows.find(r => r.id === templateId)
    const sec = tpl?.template_sections?.find(s => s.id === sectionId)
    const subs = asArray(sec?.template_subcategories)
    const maxSo = subs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_subcategories').insert({
      section_id: sectionId,
      name,
      sort_order: maxSo + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setTplCategoryDraftBySection(prev => ({ ...prev, [sectionId]: '' }))
    setTplAddCategoryOpenSectionId(null)
    await mergeTemplateRow(templateId)
  }

  function templateCategoryTargets(tpl) {
    const secs = [...(tpl.template_sections || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    const shared = secs.filter(s => s.section_type === 'shared')
    const persons = secs.filter(s => s.section_type === 'person')
    const misc = shared.filter(s => isMiscSectionName(s.name))
    const nonMisc = shared.filter(s => !isMiscSectionName(s.name))
    const ordered = [...nonMisc, ...misc, ...persons]
    return ordered.filter(s => !isMiscSectionName(s.name))
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
              const subOpts = templateCategoryTargets(tpl)

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

                      {(tpl.template_sections || []).map(sec => (
                        <div
                          key={sec.id}
                          className="space-y-2 rounded-input p-2"
                          style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {editingTplSectionId === sec.id ? (
                              <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0">
                                <input
                                  value={tplSectionEditName}
                                  onChange={e => setTplSectionEditName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && saveTplSectionName(sec.id)}
                                  className="flex-1 min-w-[8rem] text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveTplSectionName(sec.id)}
                                  className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTplSectionId(null)}
                                  className="text-12 text-content-secondary px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="min-w-0">
                                  <p className="text-12 font-medium text-content-primary">{sec.name}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTplSectionId(sec.id)
                                      setTplSectionEditName(sec.name)
                                    }}
                                    className="text-11 bg-transparent border-0 cursor-pointer p-0"
                                    style={{ color: '#2d6fb5' }}
                                  >
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTemplateSection(sec)}
                                    className="text-11 text-content-hint bg-transparent border-0 cursor-pointer p-0"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          {(sec.template_subcategories || []).map(sub => {
                            const sortedTplItems = [...asArray(sub.template_items)].sort(
                              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                            )
                            const itemIds = sortedTplItems.map(it => it.id)
                            return (
                              <div key={sub.id} className="pl-2 border-l-2 border-[#e8e4dc]">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p
                                    className="font-medium flex-1 min-w-0"
                                    style={{
                                      fontSize: 11,
                                      color: '#6b6b6b',
                                      letterSpacing: '0.06em',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {sub.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => removeTemplateCategory(sub, sec)}
                                    className="text-11 text-content-hint bg-transparent border-0 cursor-pointer p-0 flex-shrink-0"
                                  >
                                    Remove
                                  </button>
                                </div>
                                {sortedTplItems.length === 0 ? (
                                  <TemplateSubcategoryEmptyDrop subId={sub.id}>
                                    <ul className="space-y-0">
                                      <li className="text-11 italic list-none py-1" style={{ color: '#9a9a9a' }}>
                                        No items yet
                                      </li>
                                    </ul>
                                  </TemplateSubcategoryEmptyDrop>
                                ) : (
                                  <>
                                    <SortableContext
                                      items={itemIds}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <ul className="space-y-0">
                                        {sortedTplItems.map((it, idx) => (
                                          <SortableTemplateItemRow
                                            key={it.id}
                                            item={it}
                                            showBorder={idx < sortedTplItems.length - 1}
                                            onRemove={() => removeTemplateItem(it.id)}
                                          />
                                        ))}
                                      </ul>
                                    </SortableContext>
                                    <TemplateSubcategoryTailDrop subId={sub.id} />
                                  </>
                                )}
                              </div>
                            )
                          })}

                          <div className="pt-1">
                            {tplAddCategoryOpenSectionId === sec.id ? (
                              <div className="flex gap-2 items-center flex-wrap">
                                <input
                                  value={tplCategoryDraftBySection[sec.id] || ''}
                                  onChange={e =>
                                    setTplCategoryDraftBySection(prev => ({
                                      ...prev,
                                      [sec.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') addTemplateCategoryRow(sec.id, tpl.id)
                                    if (e.key === 'Escape') {
                                      setTplAddCategoryOpenSectionId(null)
                                      setTplCategoryDraftBySection(prev => ({ ...prev, [sec.id]: '' }))
                                    }
                                  }}
                                  placeholder="Category name"
                                  autoComplete="off"
                                  className="flex-1 min-w-[10rem] text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
                                />
                                <button
                                  type="button"
                                  onClick={() => addTemplateCategoryRow(sec.id, tpl.id)}
                                  className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 flex-shrink-0"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTplAddCategoryOpenSectionId(null)
                                    setTplCategoryDraftBySection(prev => ({ ...prev, [sec.id]: '' }))
                                  }}
                                  className="flex-shrink-0 p-1.5 rounded-input border-0 bg-transparent text-content-hint cursor-pointer inline-flex items-center justify-center"
                                  aria-label="Cancel adding category"
                                >
                                  <X size={18} strokeWidth={2} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTplAddCategoryOpenSectionId(sec.id)}
                                className="text-12 font-medium bg-transparent border-0 cursor-pointer p-0"
                                style={{ color: '#2d6fb5' }}
                              >
                                + Add category
                              </button>
                            )}
                          </div>

                        </div>
                      ))}

                      <div
                        className="rounded-input bg-page overflow-hidden"
                        style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                      >
                        <button
                          type="button"
                          onClick={() => setAddCategoryOpen(o => !o)}
                          aria-expanded={addCategoryOpen}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-page"
                        >
                          <span className="flex-1 text-11 font-medium uppercase tracking-[0.08em] text-content-secondary">
                            Add section
                          </span>
                          <ChevronDown
                            size={18}
                            className="text-content-hint flex-shrink-0"
                            style={{
                              transition: 'transform 200ms ease',
                              transform: addCategoryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          />
                        </button>
                        <div
                          style={{
                            display: 'grid',
                            transition: 'grid-template-rows 250ms ease',
                            gridTemplateRows: addCategoryOpen ? '1fr' : '0fr',
                          }}
                        >
                          <div style={{ overflow: 'hidden' }}>
                            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[rgba(0,0,0,0.06)]">
                              <div className="space-y-2">
                                <p className="text-12 text-content-primary">Shared section</p>
                                <div className="flex gap-2">
                                  <input
                                    value={newSharedCatName}
                                    onChange={e => setNewSharedCatName(e.target.value)}
                                    onKeyDown={e =>
                                      e.key === 'Enter' && addTemplateSharedCategory(tpl.id)
                                    }
                                    placeholder="Section name (e.g. Documents, Health)"
                                    className="flex-1 text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addTemplateSharedCategory(tpl.id)}
                                    className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 flex-shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-12 text-content-primary">Person section</p>
                                <select
                                  value={newPersonMemberId}
                                  onChange={e => {
                                    const id = e.target.value
                                    setNewPersonMemberId(id)
                                    const m = members.find(x => x.id === id)
                                    if (m) setNewPersonCatName(m.name)
                                  }}
                                  className="w-full text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                >
                                  <option value="">Select household member…</option>
                                  {members.map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <input
                                    value={newPersonCatName}
                                    onChange={e => setNewPersonCatName(e.target.value)}
                                    onKeyDown={e =>
                                      e.key === 'Enter' && addTemplatePersonCategory(tpl.id)
                                    }
                                    placeholder={
                                      members.find(m => m.id === newPersonMemberId)?.name ||
                                      'Traveller name'
                                    }
                                    className="flex-1 text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addTemplatePersonCategory(tpl.id)}
                                    className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 flex-shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="rounded-input bg-page p-2 space-y-2"
                        style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                      >
                        <input
                          value={newLabel}
                          onChange={e => setNewLabel(e.target.value)}
                          placeholder="New item"
                          className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                        />
                        <label className="block text-11 text-content-secondary">Section</label>
                        <select
                          value={addTargetSectionId}
                          onChange={e => setAddTargetSectionId(e.target.value)}
                          className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                        >
                          <option value="">Misc. — add to bottom of shared items</option>
                          {subOpts.map(s => (
                            <option key={s.id} value={String(s.id)}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {addTargetSectionId ? (
                          <>
                            <label className="block text-11 text-content-secondary">
                              Category (optional)
                            </label>
                            <select
                              value={addTargetSubcategoryId}
                              onChange={e => setAddTargetSubcategoryId(e.target.value)}
                              className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                            >
                              <option value="">
                                Section default ({DEFAULT_BUCKET_SUBCATEGORY_NAME})
                              </option>
                              {(() => {
                                const tsec = (tpl.template_sections || []).find(
                                  s => String(s.id) === String(addTargetSectionId),
                                )
                                return [...asArray(tsec?.template_subcategories)]
                                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                  .map(s => (
                                    <option key={s.id} value={String(s.id)}>
                                      {s.name}
                                    </option>
                                  ))
                              })()}
                            </select>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => addItem(tpl.id)}
                          disabled={!newLabel.trim()}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-button border border-[#e0ddd8] text-13 font-medium text-navy bg-white disabled:opacity-50"
                        >
                          <Plus size={16} />
                          Add to template
                        </button>
                      </div>
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

function TemplateSubcategoryEmptyDrop({ subId, children }) {
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

function TemplateSubcategoryTailDrop({ subId }) {
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
    <li
      ref={setNodeRef}
      style={{
        ...dndStyle,
        ...(showBorder ? { borderBottom: '0.5px solid rgba(0,0,0,0.04)' } : {}),
      }}
      className="flex items-center gap-2 text-13 py-1 list-none"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-content-hint p-0 bg-transparent border-0 inline-flex items-center justify-center"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} style={{ opacity: 0.35 }} />
      </button>
      <span className="flex-1 min-w-0 text-content-primary">{item.label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-11 text-content-hint bg-transparent border-0 cursor-pointer p-0 flex-shrink-0 leading-none"
        aria-label="Remove item"
      >
        ×
      </button>
    </li>
  )
}
