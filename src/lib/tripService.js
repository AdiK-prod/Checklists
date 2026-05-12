import { supabase } from './supabase'
import { TEMPLATE_MISC_SUBCATEGORY } from './templateLayout'

export const CHECKLIST_INSERT_CHUNK = 200
const AI_LOG_MAX_CHARS = 120_000

async function insertChecklistChunks(rows) {
  if (!rows.length) return
  for (let i = 0; i < rows.length; i += CHECKLIST_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + CHECKLIST_INSERT_CHUNK)
    const { error } = await supabase.from('checklist_items').insert(chunk)
    if (error) throw error
  }
}

function clipAiLogText(s) {
  const t = typeof s === 'string' ? s : ''
  if (t.length <= AI_LOG_MAX_CHARS) return t
  return `${t.slice(0, AI_LOG_MAX_CHARS)}\n… [truncated]`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} templateId
 */
export async function fetchTemplateTree(client, templateId) {
  const { data: sections, error: e1 } = await client
    .from('template_sections')
    .select('id, section_type, name, member_id, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')

  if (e1) throw e1
  if (!sections?.length) {
    const { data: tpl, error: te } = await client
      .from('templates')
      .select('id')
      .eq('id', templateId)
      .maybeSingle()
    if (te) throw te
    if (tpl) {
      throw new Error(
        'This packing template has no sections. Open Settings → Pack templates to repair, or choose another template.',
      )
    }
    throw new Error('Template not found or you do not have access.')
  }

  const sectionIds = sections.map(s => s.id)
  const { data: subcats, error: e2 } = await client
    .from('template_subcategories')
    .select('id, section_id, name, sort_order')
    .in('section_id', sectionIds)
    .order('sort_order')

  if (e2) throw e2

  const subIds = (subcats || []).map(s => s.id)
  let items = []
  if (subIds.length) {
    const { data: its, error: e3 } = await client
      .from('template_items')
      .select('id, subcategory_id, label, sort_order')
      .in('subcategory_id', subIds)
      .order('sort_order')
    if (e3) throw e3
    items = its || []
  }

  const bySec = new Map()
  for (const s of sections) bySec.set(s.id, { ...s, subcategories: [] })
  const bySub = new Map()
  for (const sc of subcats || []) {
    const sec = bySec.get(sc.section_id)
    if (!sec) continue
    const node = { ...sc, items: [] }
    sec.subcategories.push(node)
    bySub.set(sc.id, node)
  }
  for (const it of items) {
    const sub = bySub.get(it.subcategory_id)
    if (sub) sub.items.push(it)
  }
  for (const sec of bySec.values()) {
    sec.subcategories.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    for (const su of sec.subcategories) {
      su.items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
  }
  return sections.map(s => bySec.get(s.id))
}

export function templateTreeToBaseItems(tree) {
  const rows = []
  for (const sec of tree) {
    for (const sub of sec.subcategories || []) {
      const cat = mapToSuggestCategory(sec.name, sub.name)
      for (const it of sub.items || []) {
        rows.push({ label: it.label, category: cat })
      }
    }
  }
  return rows
}

function mapToSuggestCategory(sectionName, subName) {
  const s = String(sectionName || '').toLowerCase()
  const u = String(subName || '').toLowerCase()
  if (s === 'documents' || u.includes('travel doc') || u === 'finance') return 'Documents'
  if (u === 'clothing' || s === 'clothing') return 'Clothing'
  if (u === 'toiletries' || s === 'toiletries') return 'Toiletries'
  if (u === 'medications' || s === 'medications') return 'Medications'
  if (u === 'tech' || u === 'basics' || s === 'essentials' || u === 'health') return 'Essentials'
  if (u === 'personal') return 'Other'
  return 'Essentials'
}

async function copySubcategoriesToChecklist(client, templateSection, checklistSectionId, itemAccumulator) {
  for (const sub of templateSection.subcategories || []) {
    const { data: csub, error } = await client
      .from('checklist_subcategories')
      .insert({
        section_id: checklistSectionId,
        name: sub.name,
        sort_order: sub.sort_order ?? 0,
        is_manually_added: false,
      })
      .select('id')
      .single()
    if (error) throw error
    for (const it of sub.items || []) {
      itemAccumulator.push({
        subcategory_id: csub.id,
        label: it.label,
        sort_order: it.sort_order ?? 0,
        checked: false,
        is_ai_suggested: false,
        is_manually_added: false,
        saved_to_template: false,
      })
    }
  }
}

async function createChecklistFromTemplate(client, tripId, templateId, travellingMemberIds) {
  const tree = await fetchTemplateTree(client, templateId)
  const itemRows = []

  for (const section of tree) {
    if (section.section_type === 'shared') {
      const { data: cs, error } = await client
        .from('checklist_sections')
        .insert({
          trip_id: tripId,
          section_type: 'shared',
          name: section.name,
          member_id: null,
          sort_order: section.sort_order ?? 0,
        })
        .select('id')
        .single()
      if (error) throw error
      await copySubcategoriesToChecklist(client, section, cs.id, itemRows)
    } else if (section.section_type === 'person') {
      if (!travellingMemberIds.includes(section.member_id)) continue
      const { data: cs, error } = await client
        .from('checklist_sections')
        .insert({
          trip_id: tripId,
          section_type: 'person',
          name: section.name,
          member_id: section.member_id,
          sort_order: section.sort_order ?? 0,
        })
        .select('id')
        .single()
      if (error) throw error
      await copySubcategoriesToChecklist(client, section, cs.id, itemRows)
    }
  }

  if (itemRows.length) await insertChecklistChunks(itemRows)
}

/**
 * One shared section + one subcategory so the trip is usable if template copy failed.
 */
export async function ensureMinimalChecklistForTrip(tripId) {
  const { count, error: cErr } = await supabase
    .from('checklist_sections')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
  if (cErr) throw cErr
  if ((count ?? 0) > 0) return

  const { data: section, error: sErr } = await supabase
    .from('checklist_sections')
    .insert({
      trip_id: tripId,
      section_type: 'shared',
      name: 'Essentials',
      member_id: null,
      sort_order: 0,
    })
    .select('id')
    .single()
  if (sErr) throw sErr

  const { error: subErr } = await supabase.from('checklist_subcategories').insert({
    section_id: section.id,
    name: TEMPLATE_MISC_SUBCATEGORY,
    sort_order: 0,
    is_manually_added: true,
  })
  if (subErr) throw subErr
}

/**
 * Remove checklist rows for the trip and copy from template again.
 * Falls back to a minimal Essentials section if the template is empty or inaccessible.
 */
export async function rebuildTripChecklistFromTemplate(tripId) {
  const { data: trip, error: tErr } = await supabase
    .from('trips')
    .select('id, template_id')
    .eq('id', tripId)
    .single()
  if (tErr) throw tErr

  const { data: tt, error: ttErr } = await supabase
    .from('trip_travellers')
    .select('member_id')
    .eq('trip_id', tripId)
  if (ttErr) throw ttErr
  const memberIds = (tt || []).map(r => r.member_id)

  const { error: delErr } = await supabase.from('checklist_sections').delete().eq('trip_id', tripId)
  if (delErr) throw delErr

  if (trip.template_id) {
    try {
      await createChecklistFromTemplate(supabase, tripId, trip.template_id, memberIds)
    } catch (e) {
      console.warn('[rebuildTripChecklist] template copy failed', e)
    }
  }

  const { count, error: cntErr } = await supabase
    .from('checklist_sections')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
  if (cntErr) throw cntErr

  if ((count ?? 0) === 0) {
    await ensureMinimalChecklistForTrip(tripId)
  }
}

function suggestionIsShared(s) {
  if (s.assignToAll) return true
  const at = Array.isArray(s.assignedTo) ? s.assignedTo : []
  if (at.length > 1) return true
  return false
}

function routeAiSubcategoryName(label) {
  const l = String(label || '').toLowerCase()
  const tries = [
    { keys: ['sunscreen', 'insect repellent', 'lip balm', 'moisturiser'], name: 'Toiletries' },
    { keys: ['medication', 'pill', 'prescription', 'inhaler', 'epipen'], name: 'Medications' },
    { keys: ['diaper', 'nappy', 'wipe', 'formula', 'baby food'], name: 'Essentials' },
    { keys: ['passport', 'visa', 'insurance', 'ehic', 'boarding pass', 'booking'], name: 'Documents' },
    { keys: ['adapter', 'charger', 'power bank', 'laptop', 'cable'], name: 'Tech' },
    { keys: ['fan', 'towel', 'umbrella', 'hat', 'sunglasses'], name: 'Clothing' },
    { keys: ['snack', 'food', 'water', 'bottle'], name: 'Snacks' },
  ]
  for (const t of tries) {
    if (t.keys.some(k => l.includes(k))) return t.name
  }
  return 'Essentials'
}

async function nextSubcategorySortOrder(client, sectionId) {
  const { data: maxRow } = await client
    .from('checklist_subcategories')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (maxRow?.sort_order ?? 0) + 1
}

async function findOrCreateChecklistSubcategory(client, sectionId, name, isManual) {
  const { data: foundList, error: fErr } = await client
    .from('checklist_subcategories')
    .select('id')
    .eq('section_id', sectionId)
    .ilike('name', name)
    .limit(1)
  if (fErr) throw fErr
  if (foundList?.length) return foundList[0].id

  const so = await nextSubcategorySortOrder(client, sectionId)
  const { data: ins, error } = await client
    .from('checklist_subcategories')
    .insert({
      section_id: sectionId,
      name,
      sort_order: so,
      is_manually_added: isManual,
    })
    .select('id')
    .single()
  if (error) throw error
  return ins.id
}

async function ensureSharedTargetSection(client, tripId, sections) {
  const shared = sections.filter(s => s.section_type === 'shared')
  const essentials = shared.find(s => String(s.name).trim().toLowerCase() === 'essentials')
  const target = essentials || shared[0]
  if (target) return target

  const { data: ins, error } = await client
    .from('checklist_sections')
    .insert({
      trip_id: tripId,
      section_type: 'shared',
      name: 'Essentials',
      member_id: null,
      sort_order: 999,
    })
    .select('*')
    .single()
  if (error) throw error
  sections.push(ins)
  return ins
}

async function insertAcceptedAiSuggestions(client, tripId, travellingMemberIds, suggestions) {
  const { data: secRows, error: se } = await client
    .from('checklist_sections')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order')
  if (se) throw se
  const sections = [...(secRows || [])]

  let sortAiBase = 50_000
  const aiRows = []

  for (const s of suggestions) {
    if (!s.checked) continue

    const shared = suggestionIsShared(s)
    const at = Array.isArray(s.assignedTo)
      ? s.assignedTo.filter(id => travellingMemberIds.includes(id))
      : []
    const subcatName = routeAiSubcategoryName(s.label)

    if (shared) {
      const sec = await ensureSharedTargetSection(client, tripId, sections)
      const subId = await findOrCreateChecklistSubcategory(client, sec.id, subcatName, false)
      aiRows.push({
        subcategory_id: subId,
        label: s.label,
        sort_order: sortAiBase++,
        checked: false,
        is_ai_suggested: true,
        is_manually_added: false,
        saved_to_template: false,
      })
      continue
    }

    const memberId = at.length >= 1 ? at[0] : null
    if (!memberId) continue

    const personSec = sections.find(x => x.section_type === 'person' && x.member_id === memberId)
    if (!personSec) {
      console.warn('[AI suggest] No checklist section for travelling member', memberId, s.label)
      continue
    }
    const subId = await findOrCreateChecklistSubcategory(client, personSec.id, subcatName, false)
    aiRows.push({
      subcategory_id: subId,
      label: s.label,
      sort_order: sortAiBase++,
      checked: false,
      is_ai_suggested: true,
      is_manually_added: false,
      saved_to_template: false,
    })
  }

  if (aiRows.length) await insertChecklistChunks(aiRows)
}

/**
 * @param {object} opts
 * @param {string} opts.householdId
 * @param {string} opts.userId
 * @param {string} opts.templateId
 * @param {string[]} opts.memberIds - travellers
 * @param {string} opts.destination
 * @param {string} opts.datesFrom - yyyy-mm-dd
 * @param {string} opts.datesTo
 * @param {string} opts.weather
 * @param {string} opts.tripType
 * @param {Array<{ id: string, label: string, category?: string, checked: boolean, assignedTo: string[], assignToAll?: boolean }>} opts.suggestions - wizard AI step
 * @param {{ promptSent: string, responseRaw: string, suggestionsTotal: number, suggestionsAccepted: number }} opts.aiLog
 */
export async function createTripFromWizard(opts) {
  const {
    householdId,
    userId,
    templateId,
    memberIds,
    destination,
    datesFrom,
    datesTo,
    weather,
    tripType,
    suggestions,
    aiLog,
  } = opts

  const { data: tripRow, error: tripErr } = await supabase
    .from('trips')
    .insert({
      household_id: householdId,
      name: destination,
      destination,
      template_id: templateId,
      dates_from: datesFrom,
      dates_to: datesTo,
      weather,
      trip_type: tripType,
      status: 'upcoming',
      created_by: userId,
    })
    .select('id')
    .single()

  if (tripErr) throw tripErr
  const tripId = tripRow.id

  const ttRows = memberIds.map(member_id => ({ trip_id: tripId, member_id }))
  const { error: ttErr } = await supabase.from('trip_travellers').insert(ttRows)
  if (ttErr) throw ttErr

  await createChecklistFromTemplate(supabase, tripId, templateId, memberIds)

  const { count: secCount, error: scErr } = await supabase
    .from('checklist_sections')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
  if (scErr) throw scErr
  if ((secCount ?? 0) === 0) {
    await ensureMinimalChecklistForTrip(tripId)
  }

  await insertAcceptedAiSuggestions(supabase, tripId, memberIds, suggestions)

  const { error: logErr } = await supabase.from('ai_suggestions_log').insert({
    trip_id: tripId,
    household_id: householdId,
    prompt_sent: clipAiLogText(aiLog.promptSent || '(none)'),
    response_raw: clipAiLogText(aiLog.responseRaw || ''),
    suggestions_accepted: aiLog.suggestionsAccepted,
    suggestions_total: aiLog.suggestionsTotal,
  })

  if (logErr) throw logErr

  return { tripId }
}
