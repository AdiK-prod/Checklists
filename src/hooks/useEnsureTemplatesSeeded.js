import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { seedTemplates } from '../lib/seedTemplates'

/**
 * After DB migrations or new households, templates can be missing.
 * Seeds defaults once templates are loaded and empty.
 */
export function useEnsureTemplatesSeeded(
  householdId,
  members,
  membersLoading,
  templates,
  templatesLoading,
  refetchTemplates,
) {
  useEffect(() => {
    if (!householdId || membersLoading || templatesLoading) return
    if (templates.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        await seedTemplates(
          supabase,
          householdId,
          (members || []).map(m => ({ id: m.id, name: m.name })),
        )
        if (!cancelled) await refetchTemplates()
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    householdId,
    members,
    membersLoading,
    templates.length,
    templatesLoading,
    refetchTemplates,
  ])
}
