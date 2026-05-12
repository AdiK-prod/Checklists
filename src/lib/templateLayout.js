/** Shared section used in minimal templates / trips alongside Misc. */
export const DEFAULT_SHARED_SECTION_NAME = 'Essentials'

/** Catch-all shared category (same level as Essentials). */
export const TEMPLATE_MISC_SECTION_NAME = 'Misc.'

/** Default internal group label row per category (DB table: template_subcategories / checklist_subcategories). */
export const DEFAULT_BUCKET_SUBCATEGORY_NAME = 'Items'

export function isMiscSectionName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
  return n === 'misc' || n === 'misc.'
}

function isDefaultBucketSubcategoryName(name) {
  return String(name || '')
    .trim()
    .toLowerCase() === DEFAULT_BUCKET_SUBCATEGORY_NAME.toLowerCase()
}

/**
 * Ensures a shared "Misc." category exists and returns the id of its default "Items" group row.
 */
export async function ensureTemplateMiscSectionDefaultSubcategory(supabase, templateId) {
  const { data: sections, error: sErr } = await supabase
    .from('template_sections')
    .select('id, section_type, name, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')

  if (sErr) throw sErr

  const list = sections || []
  const sharedList = list.filter(s => s.section_type === 'shared')
  let miscSec = sharedList.find(s => isMiscSectionName(s.name))

  if (!miscSec) {
    const maxSo = list.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)
    const { data: ins, error: iErr } = await supabase
      .from('template_sections')
      .insert({
        template_id: templateId,
        section_type: 'shared',
        name: TEMPLATE_MISC_SECTION_NAME,
        member_id: null,
        sort_order: maxSo + 1,
      })
      .select('id, section_type, name, sort_order')
      .single()
    if (iErr) throw iErr
    miscSec = ins
  }

  const { data: subs, error: subErr } = await supabase
    .from('template_subcategories')
    .select('id, name, sort_order')
    .eq('section_id', miscSec.id)
    .order('sort_order')

  if (subErr) throw subErr

  const subList = subs || []
  let bucket = subList.find(s => isDefaultBucketSubcategoryName(s.name))
  if (bucket) return bucket.id

  const maxSub = subList.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
  const { data: newSub, error: insErr } = await supabase
    .from('template_subcategories')
    .insert({
      section_id: miscSec.id,
      name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
      sort_order: maxSub + 1,
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  return newSub.id
}

/**
 * When a template has no categories, create Essentials + Misc. as shared categories, each with an "Items" group row.
 */
export async function ensureTemplateHasMinimalTree(supabase, templateId) {
  const { count, error: cErr } = await supabase
    .from('template_sections')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)
  if (cErr) throw cErr
  if ((count ?? 0) > 0) return false

  const { data: ess, error: e1 } = await supabase
    .from('template_sections')
    .insert({
      template_id: templateId,
      section_type: 'shared',
      name: DEFAULT_SHARED_SECTION_NAME,
      member_id: null,
      sort_order: 0,
    })
    .select('id')
    .single()
  if (e1) throw e1

  await supabase.from('template_subcategories').insert({
    section_id: ess.id,
    name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
    sort_order: 0,
  })

  const { data: misc, error: e2 } = await supabase
    .from('template_sections')
    .insert({
      template_id: templateId,
      section_type: 'shared',
      name: TEMPLATE_MISC_SECTION_NAME,
      member_id: null,
      sort_order: 1,
    })
    .select('id')
    .single()
  if (e2) throw e2

  await supabase.from('template_subcategories').insert({
    section_id: misc.id,
    name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
    sort_order: 0,
  })

  return true
}
