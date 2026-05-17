import { useState, useEffect, useCallback, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../lib/supabase'
import { rebuildTripChecklistFromTemplate, ensureMinimalChecklistForTrip, updateChecklistItemLabel, reorderChecklistSection, reorderChecklistCategory } from '../lib/tripService'
import {
  normalizeTripDetail,
  buildSectionsTree,
  attachMembersToSections,
  normalizeMember,
  buildAiSuggestionsFromSections,
} from '../lib/transforms'
import { ensureChecklistMiscSectionBucket } from '../lib/checklistLayout'
import { DEFAULT_BUCKET_SUBCATEGORY_NAME, isDefaultBucketSubcategoryName } from '../lib/templateLayout'

function updateItemInSections(sections, itemId, patch) {
  return sections.map(sec => ({
    ...sec,
    subcategories: (sec.subcategories || []).map(sub => ({
      ...sub,
      items: (sub.items || []).map(it => (it.id === itemId ? { ...it, ...patch } : it)),
    })),
  }))
}

async function ensureTemplateSectionForChecklist(templateId, chkSectionRow) {
  if (chkSectionRow.section_type === 'shared') {
    const { data: rows, error } = await supabase
      .from('template_sections')
      .select('id')
      .eq('template_id', templateId)
      .eq('section_type', 'shared')
      .ilike('name', chkSectionRow.name)
      .limit(1)
    if (error) throw error
    if (rows?.length) return rows[0].id
  } else {
    if (chkSectionRow.member_id) {
      const { data: rows, error } = await supabase
        .from('template_sections')
        .select('id')
        .eq('template_id', templateId)
        .eq('member_id', chkSectionRow.member_id)
        .limit(1)
      if (error) throw error
      if (rows?.length) return rows[0].id
    }
    const { data: rows, error } = await supabase
      .from('template_sections')
      .select('id')
      .eq('template_id', templateId)
      .eq('section_type', 'person')
      .ilike('name', chkSectionRow.name)
      .limit(1)
    if (error) throw error
    if (rows?.length) return rows[0].id
  }

  const { data: ins, error: insErr } = await supabase
    .from('template_sections')
    .insert({
      template_id: templateId,
      section_type: chkSectionRow.section_type,
      name: chkSectionRow.name,
      member_id: chkSectionRow.member_id,
      sort_order: 999,
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  return ins.id
}

async function ensureTemplateSubcategory(templateSectionId, subName) {
  const { data: rows, error } = await supabase
    .from('template_subcategories')
    .select('id')
    .eq('section_id', templateSectionId)
    .ilike('name', subName)
    .limit(1)
  if (error) throw error
  if (rows?.length) return rows[0].id

  const { data: ins, error: insErr } = await supabase
    .from('template_subcategories')
    .insert({
      section_id: templateSectionId,
      name: subName,
      sort_order: 999,
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  return ins.id
}

export function useTripDetail(tripId) {
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const rawItemsRef = useRef([])
  const rawSubByIdRef = useRef(new Map())
  const rawSectionByIdRef = useRef(new Map())
  const templateIdRef = useRef(null)
  const tripRef = useRef(null)

  useEffect(() => {
    tripRef.current = trip
  }, [trip])

  useEffect(() => {
    if (!tripId) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: tripData, error: tripErr } = await supabase
          .from('trips')
          .select('*, trip_travellers(member_id, household_members(*))')
          .eq('id', tripId)
          .single()

        if (cancelled) return
        if (tripErr) {
          setError(tripErr)
          setTrip(null)
          return
        }

        const [sectionsRes, subcatsRes, itemsRes] = await Promise.all([
          supabase
            .from('checklist_sections')
            .select('*')
            .eq('trip_id', tripId)
            .order('sort_order'),
          supabase
            .from('checklist_subcategories')
            .select('*, checklist_sections!inner(trip_id)')
            .eq('checklist_sections.trip_id', tripId)
            .order('sort_order'),
          supabase
            .from('checklist_items')
            .select('*, checklist_subcategories!inner(section_id, checklist_sections!inner(trip_id))')
            .eq('checklist_subcategories.checklist_sections.trip_id', tripId)
            .order('sort_order'),
        ])

        if (cancelled) return

        if (sectionsRes.error) {
          setError(sectionsRes.error)
          setTrip(null)
          return
        }
        if (subcatsRes.error) {
          setError(subcatsRes.error)
          setTrip(null)
          return
        }
        if (itemsRes.error) {
          setError(itemsRes.error)
          setTrip(null)
          return
        }

        const sections = sectionsRes.data || []
        const subcats = subcatsRes.data || []
        const items = itemsRes.data || []

        rawItemsRef.current = items
        rawSubByIdRef.current = new Map(subcats.map(s => [s.id, s]))
        rawSectionByIdRef.current = new Map(sections.map(s => [s.id, s]))
        templateIdRef.current = tripData.template_id

        const { list } = buildSectionsTree(sections, subcats, items)

        const memberList = (tripData.trip_travellers || []).map(t => {
          const hm = t.household_members
          if (hm && !Array.isArray(hm) && hm.id) return normalizeMember(hm)
          const hmRow = Array.isArray(hm) ? hm[0] : hm
          if (hmRow?.id) return normalizeMember(hmRow)
          return normalizeMember({
            id: t.member_id,
            name: 'Traveller',
            role: 'parent',
            age: null,
          })
        })

        attachMembersToSections(list, memberList)

        const normalised = normalizeTripDetail(tripData, list)
        setTrip(normalised)
      } catch (e) {
        if (cancelled) return
        console.error(e)
        setError({ message: e?.message || 'Could not load trip' })
        setTrip(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [tripId, reloadNonce])

  const rebuildChecklist = useCallback(async () => {
    if (!tripId) return
    await rebuildTripChecklistFromTemplate(tripId)
    setReloadNonce(n => n + 1)
  }, [tripId])

  const addStarterChecklist = useCallback(async () => {
    if (!tripId) return
    await ensureMinimalChecklistForTrip(tripId)
    setReloadNonce(n => n + 1)
  }, [tripId])

  const toggleItem = useCallback(async itemId => {
    const raw = rawItemsRef.current.find(i => i.id === itemId)
    if (!raw) return
    const newChecked = !raw.checked

    rawItemsRef.current = rawItemsRef.current.map(i =>
      i.id === itemId ? { ...i, checked: newChecked } : i,
    )

    setTrip(prev =>
      prev ? { ...prev, sections: updateItemInSections(prev.sections, itemId, { checked: newChecked }) } : prev,
    )

    const { error: uErr } = await supabase.from('checklist_items').update({ checked: newChecked }).eq('id', itemId)
    if (uErr) console.error(uErr)
  }, [])

  const ensureFirstChecklistGroupForSection = useCallback(async sectionId => {
    const subs = [...rawSubByIdRef.current.values()]
      .filter(s => s.section_id === sectionId)
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))

    const bucket = subs.find(s => isDefaultBucketSubcategoryName(s.name))
    if (bucket) return bucket.id

    if (subs.length > 0) {
      const maxSo = subs.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)
      const { data: sr, error } = await supabase
        .from('checklist_subcategories')
        .insert({
          section_id: sectionId,
          name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
          sort_order: maxSo + 1,
          is_manually_added: true,
        })
        .select()
        .single()
      if (error) {
        console.error(error)
        throw error
      }
      rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(sr.id, sr)

      setTrip(prev => {
        if (!prev) return prev
        const newSub = {
          id: sr.id,
          name: sr.name,
          sortOrder: sr.sort_order,
          isManuallyAdded: sr.is_manually_added,
          items: [],
        }
        const sections = prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec
          const nextSubs = [...sec.subcategories, newSub].sort(
            (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
          )
          return { ...sec, subcategories: nextSubs }
        })
        return {
          ...prev,
          sections,
          aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
        }
      })
      return sr.id
    }

    const { data: sr, error } = await supabase
      .from('checklist_subcategories')
      .insert({
        section_id: sectionId,
        name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
        sort_order: 0,
        is_manually_added: true,
      })
      .select()
      .single()
    if (error) {
      console.error(error)
      throw error
    }
    rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(sr.id, sr)

    setTrip(prev => {
      if (!prev) return prev
      const newSub = {
        id: sr.id,
        name: sr.name,
        sortOrder: sr.sort_order,
        isManuallyAdded: sr.is_manually_added,
        items: [],
      }
      const sections = prev.sections.map(sec => {
        if (sec.id !== sectionId) return sec
        const nextSubs = [...sec.subcategories, newSub].sort(
          (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
        )
        return { ...sec, subcategories: nextSubs }
      })
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })
    return sr.id
  }, [])

  const insertChecklistItem = useCallback(async (subcategoryId, trimmed) => {
    if (!tripId) return null

    const siblings = rawItemsRef.current.filter(i => i.subcategory_id === subcategoryId)
    const sortBase = siblings.reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0)

    const newRaw = {
      subcategory_id: subcategoryId,
      label: trimmed,
      sort_order: sortBase + 1,
      checked: false,
      is_ai_suggested: false,
      is_manually_added: true,
      saved_to_template: false,
    }

    const { data, error: insErr } = await supabase
      .from('checklist_items')
      .insert(newRaw)
      .select()
      .single()

    if (insErr) {
      console.error('add checklist item:', insErr.message, insErr)
      return null
    }
    if (!data) return null

    rawItemsRef.current = [...rawItemsRef.current, data]

    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.map(sec => ({
        ...sec,
        subcategories: sec.subcategories.map(sub => {
          if (sub.id !== subcategoryId) return sub
          const maxSo = sub.items.reduce((m, i) => Math.max(m, Number(i.sortOrder) || 0), 0)
          const newItem = {
            id: data.id,
            subcategoryId: data.subcategory_id,
            label: data.label,
            checked: data.checked,
            isAiSuggested: data.is_ai_suggested,
            isManuallyAdded: data.is_manually_added,
            savedToTemplate: data.saved_to_template,
            sortOrder: data.sort_order ?? maxSo + 1,
          }
          return { ...sub, items: [...sub.items, newItem].sort((a, b) => a.sortOrder - b.sortOrder) }
        }),
      }))
      return { ...prev, sections, aiSuggestions: prev.aiSuggestions }
    })

    return data.id
  }, [tripId])

  const addItem = useCallback(
    async (subcategoryId, label) => {
      const trimmed = String(label || '').trim()
      if (!trimmed) return null
      return insertChecklistItem(subcategoryId, trimmed)
    },
    [insertChecklistItem],
  )

  const addChecklistCategory = useCallback(async (sectionId, name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed || !sectionId || !tripId) return null

    const subs = [...rawSubByIdRef.current.values()].filter(s => s.section_id === sectionId)
    const maxSo = subs.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)

    const { data: sr, error } = await supabase
      .from('checklist_subcategories')
      .insert({
        section_id: sectionId,
        name: trimmed,
        sort_order: maxSo + 1,
        is_manually_added: true,
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      return null
    }
    if (!sr) return null

    rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(sr.id, sr)

    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.map(sec => {
        if (sec.id !== sectionId) return sec
        const newSub = {
          id: sr.id,
          name: sr.name,
          sortOrder: sr.sort_order,
          isManuallyAdded: sr.is_manually_added,
          items: [],
        }
        const nextSubs = [...sec.subcategories, newSub].sort(
          (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
        )
        return { ...sec, subcategories: nextSubs }
      })
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })

    return sr.id
  }, [tripId])

  const renameChecklistSubcategory = useCallback(async (subcategoryId, newName) => {
    const trimmed = String(newName || '').trim()
    if (!trimmed || !subcategoryId) return

    const { error } = await supabase
      .from('checklist_subcategories')
      .update({ name: trimmed })
      .eq('id', subcategoryId)

    if (error) {
      console.error(error)
      throw error
    }

    const prevRow = rawSubByIdRef.current.get(subcategoryId)
    if (prevRow) {
      rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(subcategoryId, {
        ...prevRow,
        name: trimmed,
      })
    }

    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.map(sec => ({
        ...sec,
        subcategories: sec.subcategories.map(sub =>
          sub.id === subcategoryId ? { ...sub, name: trimmed } : sub,
        ),
      }))
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })
  }, [])

  const addItemToSection = useCallback(
    async (targetSectionId, label) => {
      if (!tripId) return null
      const trimmed = String(label || '').trim()
      if (!trimmed) return null

      if (!targetSectionId) {
        let subcategoryId = null
        try {
          const { subcategoryId: miscId, createdSection, createdSubcategory } =
            await ensureChecklistMiscSectionBucket(supabase, tripId)
          subcategoryId = miscId

          if (createdSection) {
            rawSectionByIdRef.current = new Map(rawSectionByIdRef.current).set(
              createdSection.id,
              createdSection,
            )
          }
          if (createdSubcategory) {
            rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(
              createdSubcategory.id,
              createdSubcategory,
            )
          }

          if (createdSection || createdSubcategory) {
            setTrip(prev => {
              if (!prev) return prev
              let sections = [...prev.sections]

              if (createdSection) {
                const subs =
                  createdSubcategory && createdSubcategory.section_id === createdSection.id
                    ? [
                        {
                          id: createdSubcategory.id,
                          name: createdSubcategory.name,
                          sortOrder: createdSubcategory.sort_order,
                          isManuallyAdded: createdSubcategory.is_manually_added,
                          items: [],
                        },
                      ]
                    : []
                sections.push({
                  id: createdSection.id,
                  sectionType: createdSection.section_type,
                  name: createdSection.name,
                  memberId: createdSection.member_id,
                  sortOrder: createdSection.sort_order,
                  member: null,
                  subcategories: subs,
                })
              } else if (createdSubcategory) {
                sections = sections.map(sec => {
                  if (sec.id !== createdSubcategory.section_id) return sec
                  const newSub = {
                    id: createdSubcategory.id,
                    name: createdSubcategory.name,
                    sortOrder: createdSubcategory.sort_order,
                    isManuallyAdded: createdSubcategory.is_manually_added,
                    items: [],
                  }
                  const nextSubs = [...sec.subcategories, newSub].sort(
                    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
                  )
                  return { ...sec, subcategories: nextSubs }
                })
              }

              sections.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
              return {
                ...prev,
                sections,
                aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
              }
            })
          }
        } catch (e) {
          console.error('ensure default Items bucket (Misc.):', e?.message, e)
          return null
        }
        return insertChecklistItem(subcategoryId, trimmed)
      }

      let subcategoryId
      try {
        subcategoryId = await ensureFirstChecklistGroupForSection(targetSectionId)
      } catch (e) {
        console.error(e)
        return null
      }
      return insertChecklistItem(subcategoryId, trimmed)
    },
    [tripId, insertChecklistItem, ensureFirstChecklistGroupForSection],
  )

  const quickAddItem = useCallback(
    async (payload, label) => {
      const trimmed = String(label || '').trim()
      if (!trimmed) return null
      if (!payload || payload.mode === 'misc') {
        return addItemToSection(null, trimmed)
      }
      if (payload.mode === 'section' && payload.sectionId) {
        return addItemToSection(payload.sectionId, trimmed)
      }
      if (payload.mode === 'category' && payload.subcategoryId) {
        return insertChecklistItem(payload.subcategoryId, trimmed)
      }
      return null
    },
    [addItemToSection, insertChecklistItem],
  )

  const removeChecklistItem = useCallback(async itemId => {
    // Optimistically remove from state immediately, restore on DB error
    const rawSnapshot = rawItemsRef.current.slice()
    rawItemsRef.current = rawItemsRef.current.filter(i => i.id !== itemId)

    let restoredSections = null
    setTrip(prev => {
      if (!prev) return prev
      restoredSections = prev.sections
      const sections = prev.sections.map(sec => ({
        ...sec,
        subcategories: sec.subcategories.map(sub => ({
          ...sub,
          items: sub.items.filter(i => i.id !== itemId),
        })),
      }))
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })

    const { error: delErr } = await supabase.from('checklist_items').delete().eq('id', itemId)
    if (delErr) {
      // Restore on failure
      rawItemsRef.current = rawSnapshot
      if (restoredSections) {
        setTrip(prev => prev
          ? { ...prev, sections: restoredSections, aiSuggestions: buildAiSuggestionsFromSections(restoredSections, prev.travellers) }
          : prev,
        )
      }
      console.error(delErr)
      throw delErr
    }
  }, [])

  const renameChecklistItem = useCallback(async (itemId, label) => {
    await updateChecklistItemLabel(itemId, label)
    setTrip(prev => {
      if (!prev) return prev
      return { ...prev, sections: updateItemInSections(prev.sections, itemId, { label }) }
    })
  }, [])

  const reorderItems = useCallback(async (subcategoryId, orderedIds) => {
    if (!tripId || !orderedIds.length) return
    const orderMap = new Map(orderedIds.map((id, idx) => [id, (idx + 1) * 10]))

    rawItemsRef.current = rawItemsRef.current.map(row => {
      const so = orderMap.get(row.id)
      if (so != null && row.subcategory_id === subcategoryId) return { ...row, sort_order: so }
      return row
    })

    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.map(sec => ({
        ...sec,
        subcategories: sec.subcategories.map(sub => {
          if (sub.id !== subcategoryId) return sub
          const byId = new Map(sub.items.map(i => [i.id, i]))
          const reordered = orderedIds
            .map(id => {
              const item = byId.get(id)
              const so = orderMap.get(id)
              if (!item || so == null) return null
              return { ...item, sortOrder: so }
            })
            .filter(Boolean)
          return { ...sub, items: reordered }
        }),
      }))
      return { ...prev, sections }
    })

    const results = await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('checklist_items').update({ sort_order: (idx + 1) * 10 }).eq('id', id),
      ),
    )
    const failed = results.find(r => r.error)
    if (failed?.error) console.error('reorder checklist items:', failed.error.message)
  }, [tripId])

  const moveChecklistItem = useCallback(
    async (activeId, overId) => {
      if (!tripId) return
      const aid = String(activeId)
      const oid = String(overId)
      if (aid === oid) return

      const rawActive = rawItemsRef.current.find(i => i.id === aid)
      if (!rawActive) return
      const sourceSubId = rawActive.subcategory_id

      const sortIdsForSub = subId =>
        rawItemsRef.current
          .filter(i => i.subcategory_id === subId)
          .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
          .map(i => i.id)

      let targetSubId
      let insertMode

      if (oid.startsWith('drop-end:')) {
        targetSubId = oid.slice('drop-end:'.length)
        insertMode = 'append'
      } else if (oid.startsWith('drop:')) {
        targetSubId = oid.slice('drop:'.length)
        insertMode = 'empty'
      } else {
        const rawOver = rawItemsRef.current.find(i => i.id === oid)
        if (!rawOver) return
        targetSubId = rawOver.subcategory_id
        insertMode = 'before_item'
      }

      if (sourceSubId === targetSubId) {
        if (insertMode === 'append') {
          const endSub = targetSubId
          if (String(endSub) !== String(sourceSubId)) return
          const ids = sortIdsForSub(sourceSubId)
          const oldIndex = ids.indexOf(aid)
          if (oldIndex < 0) return
          const newIds = [...ids.filter(id => id !== aid), aid]
          await reorderItems(sourceSubId, newIds)
          return
        }
        if (insertMode === 'empty') return
        const ids = sortIdsForSub(sourceSubId)
        const oldIndex = ids.indexOf(aid)
        const newIndex = ids.indexOf(oid)
        if (oldIndex < 0 || newIndex < 0) return
        await reorderItems(sourceSubId, arrayMove(ids, oldIndex, newIndex))
        return
      }

      const sourceIds = sortIdsForSub(sourceSubId).filter(id => id !== aid)
      let targetIds = sortIdsForSub(targetSubId).filter(id => id !== aid)

      let insertIndex
      if (insertMode === 'append') {
        insertIndex = targetIds.length
      } else if (insertMode === 'empty') {
        insertIndex = 0
      } else {
        insertIndex = targetIds.indexOf(oid)
        if (insertIndex < 0) insertIndex = targetIds.length
      }

      const newTargetIds = [...targetIds.slice(0, insertIndex), aid, ...targetIds.slice(insertIndex)]

      const nextRows = rawItemsRef.current.map(r => ({ ...r }))
      const applySubOrder = (subId, orderedIds) => {
        orderedIds.forEach((id, idx) => {
          const r = nextRows.find(x => x.id === id)
          if (r) {
            r.subcategory_id = subId
            r.sort_order = (idx + 1) * 10
          }
        })
      }
      applySubOrder(sourceSubId, sourceIds)
      applySubOrder(targetSubId, newTargetIds)
      rawItemsRef.current = nextRows

      setTrip(prev => {
        if (!prev) return prev
        const itemMap = new Map()
        for (const sec of prev.sections) {
          for (const sub of sec.subcategories) {
            for (const it of sub.items) itemMap.set(it.id, it)
          }
        }
        const mapIdsToItems = (subCatId, ids) =>
          ids
            .map((id, idx) => {
              const it = itemMap.get(id)
              if (!it) return null
              return {
                ...it,
                subcategoryId: subCatId,
                sortOrder: (idx + 1) * 10,
              }
            })
            .filter(Boolean)
        const sections = prev.sections.map(sec => ({
          ...sec,
          subcategories: sec.subcategories.map(sub => {
            if (sub.id === sourceSubId) {
              return { ...sub, items: mapIdsToItems(sourceSubId, sourceIds) }
            }
            if (sub.id === targetSubId) {
              return { ...sub, items: mapIdsToItems(targetSubId, newTargetIds) }
            }
            return sub
          }),
        }))
        return {
          ...prev,
          sections,
          aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
        }
      })

      const updates = []
      for (let i = 0; i < sourceIds.length; i++) {
        updates.push(
          supabase
            .from('checklist_items')
            .update({ sort_order: (i + 1) * 10, subcategory_id: sourceSubId })
            .eq('id', sourceIds[i]),
        )
      }
      for (let i = 0; i < newTargetIds.length; i++) {
        updates.push(
          supabase
            .from('checklist_items')
            .update({ sort_order: (i + 1) * 10, subcategory_id: targetSubId })
            .eq('id', newTargetIds[i]),
        )
      }
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) console.error('move checklist item:', failed.error.message)
    },
    [tripId, reorderItems],
  )

  const removeSubcategory = useCallback(async subcategoryId => {
    const { error: delErr } = await supabase.from('checklist_subcategories').delete().eq('id', subcategoryId)
    if (delErr) {
      console.error(delErr)
      throw delErr
    }
    rawItemsRef.current = rawItemsRef.current.filter(i => i.subcategory_id !== subcategoryId)
    const nextSubs = new Map(rawSubByIdRef.current)
    nextSubs.delete(subcategoryId)
    rawSubByIdRef.current = nextSubs

    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.map(sec => ({
        ...sec,
        subcategories: sec.subcategories.filter(s => s.id !== subcategoryId),
      }))
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })
  }, [])

  const removeSection = useCallback(async sectionId => {
    const { error: delErr } = await supabase.from('checklist_sections').delete().eq('id', sectionId)
    if (delErr) {
      console.error(delErr)
      throw delErr
    }
    const subIds = [...rawSubByIdRef.current.values()]
      .filter(s => s.section_id === sectionId)
      .map(s => s.id)
    const subSet = new Set(subIds)
    rawItemsRef.current = rawItemsRef.current.filter(i => !subSet.has(i.subcategory_id))
    const nextSubs = new Map(rawSubByIdRef.current)
    for (const id of subIds) nextSubs.delete(id)
    rawSubByIdRef.current = nextSubs
    const nextSecs = new Map(rawSectionByIdRef.current)
    nextSecs.delete(sectionId)
    rawSectionByIdRef.current = nextSecs

    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.filter(s => s.id !== sectionId)
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })
  }, [])

  const updateSection = useCallback(async (sectionId, name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    const { error: uErr } = await supabase
      .from('checklist_sections')
      .update({ name: trimmed })
      .eq('id', sectionId)
    if (uErr) {
      console.error(uErr)
      throw uErr
    }
    const prevRow = rawSectionByIdRef.current.get(sectionId)
    if (prevRow) {
      rawSectionByIdRef.current = new Map(rawSectionByIdRef.current).set(sectionId, {
        ...prevRow,
        name: trimmed,
      })
    }
    setTrip(prev => {
      if (!prev) return prev
      const sections = prev.sections.map(s => (s.id === sectionId ? { ...s, name: trimmed } : s))
      return {
        ...prev,
        sections,
        aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
      }
    })
  }, [])

  const addSection = useCallback(
    async ({ sectionType, name, memberId }) => {
      if (!tripId) return null
      const trimmed = String(name || '').trim()
      if (!trimmed) return null
      if (sectionType === 'person' && !memberId) return null

      if (sectionType === 'person') {
        const dup = [...rawSectionByIdRef.current.values()].some(
          s => s.section_type === 'person' && s.member_id === memberId,
        )
        if (dup) return null
      }

      const sectionsArr = [...rawSectionByIdRef.current.values()]
      const maxSo = sectionsArr.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)

      const { data, error: insErr } = await supabase
        .from('checklist_sections')
        .insert({
          trip_id: tripId,
          section_type: sectionType,
          name: trimmed,
          member_id: sectionType === 'person' ? memberId : null,
          sort_order: maxSo + 1,
        })
        .select()
        .single()

      if (insErr) {
        console.error(insErr)
        return null
      }
      if (!data) return null

      rawSectionByIdRef.current = new Map(rawSectionByIdRef.current).set(data.id, data)

      setTrip(prev => {
        if (!prev) return prev
        const member =
          sectionType === 'person' && memberId
            ? prev.members.find(m => m.id === memberId) || null
            : null
        const newSec = {
          id: data.id,
          sectionType: data.section_type,
          name: data.name,
          memberId: data.member_id,
          sortOrder: data.sort_order,
          member,
          subcategories: [],
        }
        const sections = [...prev.sections, newSec].sort(
          (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
        )
        return {
          ...prev,
          sections,
          aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
        }
      })

      return data.id
    },
    [tripId],
  )

  const saveToTemplate = useCallback(async itemId => {
    const templateId = templateIdRef.current
    const raw = rawItemsRef.current.find(i => i.id === itemId)
    if (!raw || !templateId) return

    const subRow = rawSubByIdRef.current.get(raw.subcategory_id)
    if (!subRow) return
    const chkSection = rawSectionByIdRef.current.get(subRow.section_id)
    if (!chkSection) return

    const tplSecId = await ensureTemplateSectionForChecklist(templateId, chkSection)
    const tplSubId = await ensureTemplateSubcategory(tplSecId, subRow.name)

    const { error: insErr } = await supabase.from('template_items').insert({
      subcategory_id: tplSubId,
      label: raw.label,
      sort_order: 999,
    })
    if (insErr) {
      console.error('save to template:', insErr.message)
      throw insErr
    }

    rawItemsRef.current = rawItemsRef.current.map(i =>
      i.id === itemId ? { ...i, saved_to_template: true } : i,
    )

    setTrip(prev =>
      prev
        ? { ...prev, sections: updateItemInSections(prev.sections, itemId, { savedToTemplate: true }) }
        : prev,
    )

    const { error: upErr } = await supabase
      .from('checklist_items')
      .update({ saved_to_template: true })
      .eq('id', itemId)
    if (upErr) console.error(upErr)
  }, [])

  const reorderTripSection = useCallback(async (sectionId, direction, track) => {
    const prev = tripRef.current
    if (!prev) return
    const trackList = prev.sections
      .filter(s => s.sectionType === track)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    const idx = trackList.findIndex(s => s.id === sectionId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= trackList.length) return
    const a = trackList[idx]
    const b = trackList[swapIdx]
    const orderA = Number(a.sortOrder) || 0
    const orderB = Number(b.sortOrder) || 0

    const sections = prev.sections
      .map(s => {
        if (s.id === a.id) return { ...s, sortOrder: orderB }
        if (s.id === b.id) return { ...s, sortOrder: orderA }
        return s
      })
      .sort((x, y) => (Number(x.sortOrder) || 0) - (Number(y.sortOrder) || 0))

    const nextTrip = {
      ...prev,
      sections,
      aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
    }

    setTrip(nextTrip)

    try {
      await reorderChecklistSection(supabase, sectionId, direction, trackList)
      const ra = rawSectionByIdRef.current.get(a.id)
      const rb = rawSectionByIdRef.current.get(b.id)
      if (ra && rb) {
        const t = ra.sort_order
        ra.sort_order = rb.sort_order
        rb.sort_order = t
      }
    } catch (e) {
      console.error(e)
      setTrip(prev)
      throw e
    }
  }, [])

  const reorderTripCategory = useCallback(async (sectionId, categoryId, direction) => {
    const prev = tripRef.current
    if (!prev) return
    const sec = prev.sections.find(s => s.id === sectionId)
    if (!sec) return
    const cats = [...(sec.subcategories || [])].sort(
      (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
    )
    const idx = cats.findIndex(c => c.id === categoryId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= cats.length) return
    const a = cats[idx]
    const b = cats[swapIdx]
    const orderA = Number(a.sortOrder) || 0
    const orderB = Number(b.sortOrder) || 0

    const sections = prev.sections.map(s => {
      if (s.id !== sectionId) return s
      const nextSubs = (s.subcategories || [])
        .map(sub => {
          if (sub.id === a.id) return { ...sub, sortOrder: orderB }
          if (sub.id === b.id) return { ...sub, sortOrder: orderA }
          return sub
        })
        .sort((x, y) => (Number(x.sortOrder) || 0) - (Number(y.sortOrder) || 0))
      return { ...s, subcategories: nextSubs }
    })

    const nextTrip = {
      ...prev,
      sections,
      aiSuggestions: buildAiSuggestionsFromSections(sections, prev.travellers),
    }
    setTrip(nextTrip)

    try {
      await reorderChecklistCategory(supabase, categoryId, direction, cats)
      const ra = rawSubByIdRef.current.get(a.id)
      const rb = rawSubByIdRef.current.get(b.id)
      if (ra && rb) {
        const t = ra.sort_order
        ra.sort_order = rb.sort_order
        rb.sort_order = t
      }
    } catch (e) {
      console.error(e)
      setTrip(prev)
      throw e
    }
  }, [])

  return {
    trip,
    loading,
    error,
    toggleItem,
    addItem,
    addItemToSection,
    quickAddItem,
    removeChecklistItem,
    renameChecklistItem,
    removeSubcategory,
    renameChecklistSubcategory,
    saveToTemplate,
    reorderItems,
    moveChecklistItem,
    rebuildChecklist,
    addStarterChecklist,
    addSection,
    addChecklistCategory,
    updateSection,
    removeSection,
    reorderTripSection,
    reorderTripCategory,
  }
}
