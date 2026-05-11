import { supabase } from './supabase'

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
 * @param {Array<{ id: string, label: string, category?: string, checked: boolean, assignedTo: string[] }>} opts.suggestions - wizard AI step
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
      name:         destination,
      destination,
      template_id:  templateId,
      dates_from:   datesFrom,
      dates_to:     datesTo,
      weather,
      trip_type:    tripType,
      status:       'upcoming',
      created_by:   userId,
    })
    .select('id')
    .single()

  if (tripErr) throw tripErr
  const tripId = tripRow.id

  const ttRows = memberIds.map(member_id => ({ trip_id: tripId, member_id }))
  const { error: ttErr } = await supabase.from('trip_travellers').insert(ttRows)
  if (ttErr) throw ttErr

  const { data: templateItems, error: tiErr } = await supabase
    .from('template_items')
    .select('id, label, category, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')

  if (tiErr) throw tiErr

  const baseRows = []
  for (const mId of memberIds) {
    for (const ti of templateItems || []) {
      baseRows.push({
        trip_id:            tripId,
        member_id:          mId,
        label:              ti.label,
        category:           ti.category,
        sort_order:         ti.sort_order,
        checked:            false,
        is_ai_suggested:    false,
        is_manually_added:  false,
        saved_to_template:  false,
      })
    }
  }

  if (baseRows.length) {
    const { error: ciErr } = await supabase.from('checklist_items').insert(baseRows)
    if (ciErr) throw ciErr
  }

  let sortBase = 10000
  const aiRows = []
  for (const s of suggestions) {
    if (!s.checked) continue
    const cat = s.category || 'Other'
    const targets = (s.assignedTo && s.assignedTo.length) ? s.assignedTo : memberIds
    for (const mId of targets) {
      if (!memberIds.includes(mId)) continue
      aiRows.push({
        trip_id:            tripId,
        member_id:          mId,
        label:              s.label,
        category:           cat,
        sort_order:         sortBase++,
        checked:            false,
        is_ai_suggested:    true,
        is_manually_added:  false,
        saved_to_template:  false,
      })
    }
  }

  if (aiRows.length) {
    const { error: aiErr } = await supabase.from('checklist_items').insert(aiRows)
    if (aiErr) throw aiErr
  }

  const { error: logErr } = await supabase.from('ai_suggestions_log').insert({
    trip_id:                tripId,
    household_id:           householdId,
    prompt_sent:            aiLog.promptSent,
    response_raw:           aiLog.responseRaw,
    suggestions_accepted:   aiLog.suggestionsAccepted,
    suggestions_total:      aiLog.suggestionsTotal,
  })

  if (logErr) throw logErr

  return { tripId }
}
