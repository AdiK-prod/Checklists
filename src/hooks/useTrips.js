import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTripRow } from '../lib/transforms'

export function useTrips(householdId) {
  const [trips, setTrips]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!householdId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('trips')
        .select('*, trip_travellers(member_id), checklist_items(id, checked)')
        .eq('household_id', householdId)
        .order('dates_from', { ascending: true })

      if (cancelled) return
      if (error) { setError(error); setLoading(false); return }
      const rows = Array.isArray(data) ? data : []
      setTrips(rows.map(normalizeTripRow))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [householdId])

  return { trips, loading, error }
}
