import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTripDetail } from '../lib/transforms'

export function useTripDetail(tripId) {
  const [trip, setTrip]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  // Keep raw items in a ref for optimistic update mutations
  const rawItemsRef = useRef([])

  useEffect(() => {
    if (!tripId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          trip_travellers(member_id, household_members(*)),
          checklist_items(*)
        `)
        .eq('id', tripId)
        .single()

      if (cancelled) return
      if (error) { setError(error); setLoading(false); return }
      rawItemsRef.current = data.checklist_items || []
      setTrip(normalizeTripDetail(data))
      setLoading(false)
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
          [memberId]: (prev.checklists[memberId] || []).map(item =>
            item.id === itemId ? { ...item, checked: newChecked } : item
          ),
        },
      }
    })

    await supabase.from('checklist_items').update({ checked: newChecked }).eq('id', itemId)
  }, [])

  const addItem = useCallback(async (memberId, label) => {
    if (!tripId) return null
    const newRaw = {
      trip_id:          tripId,
      member_id:        memberId,
      label,
      category:         'Other',
      checked:          false,
      is_ai_suggested:  false,
      is_manually_added: true,
      saved_to_template: false,
      sort_order:       Date.now(),
    }
    const { data, error } = await supabase
      .from('checklist_items').insert(newRaw).select().single()
    if (error || !data) return null

    rawItemsRef.current = [...rawItemsRef.current, data]
    setTrip(prev => {
      if (!prev) return prev
      const normalized = {
        id:              data.id,
        label:           data.label,
        category:        data.category,
        checked:         data.checked,
        isAiSuggested:   data.is_ai_suggested,
        isManuallyAdded: data.is_manually_added,
        savedToTemplate: data.saved_to_template,
        sortOrder:       data.sort_order,
      }
      return {
        ...prev,
        checklists: {
          ...prev.checklists,
          [memberId]: [...(prev.checklists[memberId] || []), normalized],
        },
      }
    })
    return data.id
  }, [tripId])

  const saveToTemplate = useCallback(async (memberId, itemId) => {
    rawItemsRef.current = rawItemsRef.current.map(i =>
      i.id === itemId ? { ...i, saved_to_template: true } : i
    )
    setTrip(prev => {
      if (!prev) return prev
      return {
        ...prev,
        checklists: {
          ...prev.checklists,
          [memberId]: (prev.checklists[memberId] || []).map(item =>
            item.id === itemId ? { ...item, savedToTemplate: true } : item
          ),
        },
      }
    })
    await supabase.from('checklist_items').update({ saved_to_template: true }).eq('id', itemId)
  }, [])

  return { trip, loading, error, toggleItem, addItem, saveToTemplate }
}
