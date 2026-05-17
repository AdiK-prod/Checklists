import { supabase } from './supabase'

function normSortOrder(row) {
  return Number(row?.sort_order ?? row?.sortOrder ?? 0)
}

/** Reorder template_sections within one section track (`shared` or `person`). */
export async function reorderTemplateSection(client, sectionId, direction, allSections) {
  const sb = client ?? supabase
  const sorted = [...allSections].sort((a, b) => normSortOrder(a) - normSortOrder(b))
  const idx = sorted.findIndex(s => s.id === sectionId)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return

  const current = sorted[idx]
  const swap = sorted[swapIdx]
  const tempOrder = normSortOrder(current)
  const swapOrder = normSortOrder(swap)

  const [r1, r2] = await Promise.all([
    sb.from('template_sections').update({ sort_order: swapOrder }).eq('id', current.id),
    sb.from('template_sections').update({ sort_order: tempOrder }).eq('id', swap.id),
  ])
  if (r1.error) throw r1.error
  if (r2.error) throw r2.error
}

/** Reorder template_subcategories within one section. */
export async function reorderTemplateCategory(client, categoryId, direction, allCategories) {
  const sb = client ?? supabase
  const sorted = [...allCategories].sort((a, b) => normSortOrder(a) - normSortOrder(b))
  const idx = sorted.findIndex(c => c.id === categoryId)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return

  const current = sorted[idx]
  const swap = sorted[swapIdx]
  const tempOrder = normSortOrder(current)
  const swapOrder = normSortOrder(swap)

  const [r1, r2] = await Promise.all([
    sb.from('template_subcategories').update({ sort_order: swapOrder }).eq('id', current.id),
    sb.from('template_subcategories').update({ sort_order: tempOrder }).eq('id', swap.id),
  ])
  if (r1.error) throw r1.error
  if (r2.error) throw r2.error
}
