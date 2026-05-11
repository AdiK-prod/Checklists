import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTripDetail, asArray, normalizeItem } from '../lib/transforms'

function maxSortOrderForMember(rawRows, memberId) {
  return rawRows
    .filter(r => r.member_id === memberId)
    .reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0)
}

export function useTripDetail(tripId) {
  const [trip, setTrip]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  // Keep raw items in a ref for optimistic update mutations
  const rawItemsRef   = useRef([])
  const templateIdRef = useRef(null)

  useEffect(() => {
    if (!tripId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('trips')
          .select(`
          *,
          trip_travellers(member_id, household_members(*)),
          checklist_items(*)
        `)
          .eq('id', tripId)
          .single()

        if (cancelled) return
        if (qErr) {
          setError(qErr)
          return
        }
        rawItemsRef.current = asArray(data.checklist_items)
        templateIdRef.current = data.template_id
        setTrip(normalizeTripDetail(data))
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
    return () => { cancelled = true }
  }, [tripId])

  const toggleItem = useCallback(async (memberId, itemId) => {
    const raw = rawItemsRef.current.find(i => i.id === itemId)
    if (!raw) return
    const newChecked = !raw.checked

    // Optimistic update
    rawItemsRef.current = rawItemsRef.current.map(i =>
      i.id === itemId ? { ...i, checked: newChecked } : i
    )
    setTrip(prev => {
      if (!prev) return prev
      return {
        ...prev,
        checklists: {
          ...prev.checklists,
          [memberId]: asArray(prev.checklists[memberId]).map(item =>
            item.id === itemId ? { ...item, checked: newChecked } : item
          ),
        },
      }
    })

    await supabase.from('checklist_items').update({ checked: newChecked }).eq('id', itemId)
  }, [])

  const addItem = useCallback(async (memberId, label) => {
    if (!tripId) return null
    const sortBase = maxSortOrderForMember(rawItemsRef.current, memberId)
    const newRaw = {
      trip_id:          tripId,
      member_id:        memberId,
      label,
      category:         'Other',
      checked:          false,
      is_ai_suggested:  false,
      is_manually_added: true,
      saved_to_template: false,
      sort_order:       sortBase + 1,
    }
    const { data, error } = await supabase
      .from('checklist_items').insert(newRaw).select().single()
    if (error) {
      console.error('add checklist item:', error.message, error)
      return null
    }
    if (!data) return null

    rawItemsRef.current = [...rawItemsRef.current, data]
    setTrip(prev => {
      if (!prev) return prev
      const normalized = normalizeItem(data)
      return {
        ...prev,
        checklists: {
          ...prev.checklists,
          [memberId]: [...asArray(prev.checklists[memberId]), normalized],
        },
      }
    })
    return data.id
  }, [tripId])

  const reorderItems = useCallback(async (memberId, orderedIds) => {
    if (!tripId || !orderedIds.length) return
    const orderMap = new Map(orderedIds.map((id, idx) => [id, (idx + 1) * 10]))

    rawItemsRef.current = rawItemsRef.current.map(row => {
      const so = orderMap.get(row.id)
      if (so != null && row.member_id === memberId) return { ...row, sort_order: so }
      return row
    })

    setTrip(prev => {
      if (!prev) return prev
      const list = asArray(prev.checklists[memberId])
      const byId = new Map(list.map(i => [i.id, i]))
      const reordered = orderedIds
        .map(id => {
          const item = byId.get(id)
          const so = orderMap.get(id)
          if (!item || so == null) return null
          return { ...item, sortOrder: so }
        })
        .filter(Boolean)
      return {
        ...prev,
        checklists: { ...prev.checklists, [memberId]: reordered },
      }
    })

    const results = await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('checklist_items').update({ sort_order: (idx + 1) * 10 }).eq('id', id),
      ),
    )
    const failed = results.find(r => r.error)
    if (failed?.error) console.error('reorder checklist items:', failed.error.message)
  }, [tripId])

  const saveToTemplate = useCallback(async (memberId, itemId) => {
    const templateId = templateIdRef.current
    const raw        = rawItemsRef.current.find(i => i.id === itemId)
    if (!raw || !templateId) return

    const { data: maxRow, error: maxErr } = await supabase
      .from('template_items')
      .select('sort_order')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxErr) {
      console.error('template sort lookup:', maxErr.message)
      throw maxErr
    }

    const nextSort = (maxRow?.sort_order ?? 0) + 1

    const { error: insErr } = await supabase.from('template_items').insert({
      template_id: templateId,
      label:       raw.label,
      category:    raw.category || 'Other',
      sort_order:  nextSort,
    })
    if (insErr) {
      console.error('save to template:', insErr.message)
      throw insErr
    }

    rawItemsRef.current = rawItemsRef.current.map(i =>
      i.id === itemId ? { ...i, saved_to_template: true } : i,
    )
    setTrip(prev => {
      if (!prev) return prev
      return {
        ...prev,
        checklists: {
          ...prev.checklists,
          [memberId]: asArray(prev.checklists[memberId]).map(item =>
            item.id === itemId ? { ...item, savedToTemplate: true } : item,
          ),
        },
      }
    })

    await supabase.from('checklist_items').update({ saved_to_template: true }).eq('id', itemId)
  }, [])

  return { trip, loading, error, toggleItem, addItem, saveToTemplate, reorderItems }
}
