import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { rebuildTripChecklistFromTemplate, ensureMinimalChecklistForTrip } from '../lib/tripService'
import {
  normalizeTripDetail,
  buildSectionsTree,
  attachMembersToSections,
  normalizeMember,
} from '../lib/transforms'
import { ensureChecklistMiscSubcategory } from '../lib/checklistLayout'

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

  const addItemToSection = useCallback(
    async (sectionId, preferredSubId, label) => {
      if (!tripId) return null
      const trimmed = String(label || '').trim()
      if (!trimmed) return null

      let subcategoryId = preferredSubId && String(preferredSubId).trim() ? preferredSubId : null

      if (!subcategoryId) {
        try {
          const { subcategoryId: miscId, created } = await ensureChecklistMiscSubcategory(supabase, sectionId)
          subcategoryId = miscId
          if (created) {
            rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(created.id, created)
            setTrip(prev => {
              if (!prev) return prev
              const sections = prev.sections.map(sec => {
                if (sec.id !== sectionId) return sec
                const newSub = {
                  id: created.id,
                  name: created.name,
                  sortOrder: created.sort_order,
                  isManuallyAdded: created.is_manually_added,
                  items: [],
                }
                const nextSubs = [...sec.subcategories, newSub].sort(
                  (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
                )
                return { ...sec, subcategories: nextSubs }
              })
              return { ...prev, sections, aiSuggestions: prev.aiSuggestions }
            })
          }
        } catch (e) {
          console.error('ensure Misc. subcategory:', e?.message, e)
          return null
        }
      }

      return insertChecklistItem(subcategoryId, trimmed)
    },
    [tripId, insertChecklistItem],
  )

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

  const addSubcategory = useCallback(
    async (sectionId, name) => {
      if (!tripId) return null
      const trimmed = String(name || '').trim()
      if (!trimmed) return null

      const subs = [...rawSubByIdRef.current.values()].filter(s => s.section_id === sectionId)
      const sortBase = subs.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)

      const { data, error: insErr } = await supabase
        .from('checklist_subcategories')
        .insert({
          section_id: sectionId,
          name: trimmed,
          sort_order: sortBase + 1,
          is_manually_added: true,
        })
        .select()
        .single()

      if (insErr) {
        console.error(insErr)
        return null
      }

      rawSubByIdRef.current = new Map(rawSubByIdRef.current).set(data.id, data)

      setTrip(prev => {
        if (!prev) return prev
        const sections = prev.sections.map(sec => {
          if (sec.id !== sectionId) return sec
          const newSub = {
            id: data.id,
            name: data.name,
            sortOrder: data.sort_order,
            isManuallyAdded: data.is_manually_added,
            items: [],
          }
          return { ...sec, subcategories: [...sec.subcategories, newSub] }
        })
        return { ...prev, sections }
      })

      return data.id
    },
    [tripId],
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
      return { ...prev, sections }
    })
  }, [])

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

  return {
    trip,
    loading,
    error,
    toggleItem,
    addItem,
    addItemToSection,
    addSubcategory,
    removeSubcategory,
    saveToTemplate,
    reorderItems,
    rebuildChecklist,
    addStarterChecklist,
  }
}
