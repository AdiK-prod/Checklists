import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { asArray } from '../lib/transforms'

function countTemplateItems(sections) {
  let n = 0
  for (const sec of asArray(sections)) {
    for (const sub of asArray(sec.template_subcategories)) {
      n += asArray(sub.template_items).length
    }
  }
  return n
}

export function useTemplates(householdId) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!householdId) {
      setTemplates([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('templates')
      .select(
        `
          *,
          template_sections(
            id,
            section_type,
            name,
            member_id,
            sort_order,
            template_subcategories(
              id,
              name,
              sort_order,
              template_items(id, label, sort_order)
            )
          )
        `,
      )
      .eq('household_id', householdId)
      .order('created_at')

    if (qErr) {
      setError(qErr)
      setLoading(false)
      return
    }
    const rows = Array.isArray(data) ? data : []
    setTemplates(
      rows.map(t => ({
        id: t.id,
        name: t.name,
        icon: t.icon,
        itemCount: countTemplateItems(t.template_sections),
        template_sections: [...asArray(t.template_sections)].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      })),
    )
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  return { templates, loading, error, refetch: load }
}
