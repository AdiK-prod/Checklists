import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeMember, asArray } from '../lib/transforms'

export function useHousehold(householdId) {
  const [household, setHousehold] = useState(null)
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!householdId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const [hhRes, memRes] = await Promise.all([
        supabase.from('households').select('*').eq('id', householdId).single(),
        supabase.from('household_members').select('*').eq('household_id', householdId).order('created_at'),
      ])

      if (cancelled) return
      if (hhRes.error) { setError(hhRes.error); setLoading(false); return }
      if (memRes.error) { setError(memRes.error); setLoading(false); return }

      setHousehold(hhRes.data)
      setMembers(asArray(memRes.data).map(normalizeMember))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [householdId])

  return { household, members, loading, error }
}
