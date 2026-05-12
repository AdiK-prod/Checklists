import { TEMPLATE_MISC_SUBCATEGORY, isMiscSubcategoryName } from './templateLayout'

/**
 * Ensures a checklist section has a bottom "Misc." subcategory (trip packing list).
 * @returns {{ subcategoryId: string, created: object | null }} created row when inserted (Supabase shape).
 */
export async function ensureChecklistMiscSubcategory(client, sectionId) {
  const { data: subs, error: subErr } = await client
    .from('checklist_subcategories')
    .select('id, name, sort_order, section_id, is_manually_added')
    .eq('section_id', sectionId)
    .order('sort_order')

  if (subErr) throw subErr

  const subList = subs || []
  const existingMisc = subList.find(s => isMiscSubcategoryName(s.name))
  if (existingMisc) return { subcategoryId: existingMisc.id, created: null }

  const maxSo = subList.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
  const { data: newSub, error: insErr } = await client
    .from('checklist_subcategories')
    .insert({
      section_id: sectionId,
      name: TEMPLATE_MISC_SUBCATEGORY,
      sort_order: maxSo + 1,
      is_manually_added: true,
    })
    .select()
    .single()
  if (insErr) throw insErr
  return { subcategoryId: newSub.id, created: newSub }
}
