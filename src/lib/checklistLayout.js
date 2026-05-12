import {
  TEMPLATE_MISC_SECTION_NAME,
  DEFAULT_BUCKET_SUBCATEGORY_NAME,
  isDefaultBucketSubcategoryName,
  isMiscSectionName,
} from './templateLayout'

/**
 * Ensures a shared "Misc." category exists on the trip and returns its default group label row ("Items" in DB).
 * @returns {{ subcategoryId: string, createdSection: object | null, createdSubcategory: object | null }}
 */
export async function ensureChecklistMiscSectionBucket(client, tripId) {
  const { data: sections, error: sErr } = await client
    .from('checklist_sections')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order')

  if (sErr) throw sErr

  const list = sections || []
  const sharedList = list.filter(s => s.section_type === 'shared')
  let miscSec = sharedList.find(s => isMiscSectionName(s.name))
  let createdSection = null

  if (!miscSec) {
    const maxSo = list.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)
    const { data: ins, error: iErr } = await client
      .from('checklist_sections')
      .insert({
        trip_id: tripId,
        section_type: 'shared',
        name: TEMPLATE_MISC_SECTION_NAME,
        member_id: null,
        sort_order: maxSo + 1,
      })
      .select()
      .single()
    if (iErr) throw iErr
    miscSec = ins
    createdSection = ins
  }

  const { data: subs, error: subErr } = await client
    .from('checklist_subcategories')
    .select('*')
    .eq('section_id', miscSec.id)
    .order('sort_order')

  if (subErr) throw subErr

  const subList = subs || []
  let bucket = subList.find(s => isDefaultBucketSubcategoryName(s.name))
  let createdSubcategory = null

  if (!bucket) {
    const maxSub = subList.reduce((m, s) => Math.max(m, Number(s.sort_order) || 0), 0)
    const { data: ins, error: insErr } = await client
      .from('checklist_subcategories')
      .insert({
        section_id: miscSec.id,
        name: DEFAULT_BUCKET_SUBCATEGORY_NAME,
        sort_order: maxSub + 1,
        is_manually_added: true,
      })
      .select()
      .single()
    if (insErr) throw insErr
    bucket = ins
    createdSubcategory = ins
  }

  return {
    subcategoryId: bucket.id,
    createdSection,
    createdSubcategory,
  }
}
