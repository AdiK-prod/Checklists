import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTemplates(householdId) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!householdId) { setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('templates')
        .select('*, template_items(id)')
        .eq('household_id', householdId)
        .order('created_at')

      if (cancelled) return
      if (error) { setError(error); setLoading(false); return }
      setTemplates((data || []).map(t => ({
        id:        t.id,
        name:      t.name,
        icon:      t.icon,
        itemCount: t.template_items?.length ?? 0,
      })))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [householdId])

  return { templates, loading, error }
}
