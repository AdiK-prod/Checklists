/**
 * Default catch-all for template items when the user does not pick a subcategory.
 * Placed at the bottom of the last shared section's subcategory list.
 */
export const TEMPLATE_MISC_SUBCATEGORY = 'Misc.'
const DEFAULT_SHARED_SECTION = 'Essentials'

export function isMiscSubcategoryName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
  return n === 'misc' || n === 'misc.'
}

/**
 * Ensures the template has at least one shared section and a bottom "Misc." subcategory.
 * @returns {Promise<string>} template_subcategories.id for Misc.
 */
export async function ensureTemplateMiscSubcategory(supabase, templateId) {
  const { data: sections, error: sErr } = await supabase
    .from('template_sections')
    .select('id, section_type, name, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')

  if (sErr) throw sErr

  let list = sections || []
  let sharedSorted = list.filter(s => s.section_type === 'shared').sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  if (!sharedSorted.length) {
    const minSo =
      list.length === 0 ? 0 : Math.min(...list.map(s => Number(s.sort_order) || 0))
    const { data: ins, error: iErr } = await supabase
      .from('template_sections')
      .insert({
        template_id: templateId,
        section_type: 'shared',
        name: DEFAULT_SHARED_SECTION,
        member_id: null,
        sort_order: minSo - 1,
      })
      .select('id, section_type, name, sort_order')
      .single()
    if (iErr) throw iErr
    sharedSorted = [ins]
    list = [...list, ins]
  }

  const targetSection = sharedSorted[sharedSorted.length - 1]

  const { data: subs, error: subErr } = await supabase
    .from('template_subcategories')
    .select('id, name, sort_order')
    .eq('section_id', targetSection.id)
    .order('sort_order')

  if (subErr) throw subErr

  const subList = subs || []
  const existingMisc = subList.find(s => isMiscSubcategoryName(s.name))
  if (existingMisc) return existingMisc.id

  const maxSo = subList.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
  const { data: newSub, error: insErr } = await supabase
    .from('template_subcategories')
    .insert({
      section_id: targetSection.id,
      name: TEMPLATE_MISC_SUBCATEGORY,
      sort_order: maxSo + 1,
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  return newSub.id
}

/**
 * When a template has no sections at all, callers should run this so the UI can show
 * structure (+ subcategory controls). Creates shared Essentials + Misc via {@link ensureTemplateMiscSubcategory}.
 */
export async function ensureTemplateHasMinimalTree(supabase, templateId) {
  const { count, error: cErr } = await supabase
    .from('template_sections')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)
  if (cErr) throw cErr
  if ((count ?? 0) > 0) return false

  await ensureTemplateMiscSubcategory(supabase, templateId)
  return true
}
