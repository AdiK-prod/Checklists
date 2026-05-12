import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTripRow } from '../lib/transforms'

export function useTrips(householdId) {
  const [trips, setTrips]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!householdId) {
      setTrips([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('trips')
      .select(
        `
        *,
        trip_travellers(member_id),
        checklist_sections(
          checklist_subcategories(
            checklist_items(id, checked)
          )
        )
      `,
      )
      .eq('household_id', householdId)
      .order('dates_from', { ascending: true })

    if (qErr) {
      setError(qErr)
      setLoading(false)
      return
    }
    const rows = Array.isArray(data) ? data : []
    setTrips(rows.map(normalizeTripRow))
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  const deleteTrip = useCallback(async (tripId) => {
    const { error: delErr } = await supabase.from('trips').delete().eq('id', tripId)
    if (delErr) {
      console.error('delete trip:', delErr)
      return { ok: false, error: delErr }
    }
    setTrips(prev => prev.filter(t => t.id !== tripId))
    return { ok: true, error: null }
  }, [])

  return { trips, loading, error, deleteTrip, refetch: load }
}
