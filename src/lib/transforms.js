// Data normalisation — converts snake_case Supabase rows to camelCase UI shapes.
// All DB access goes through hooks in /src/hooks/; transforms live here.

const AVATAR_PALETTE = [
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#F3E8F3', text: '#6B2F6B' },
  { bg: '#E8F5E8', text: '#2A5A2A' },
]

function hashId(id = '') {
  let h = 0
  for (const c of String(id)) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function normalizeMember(row) {
  const palette = AVATAR_PALETTE[hashId(row.id) % AVATAR_PALETTE.length]
  return {
    id:           row.id,
    name:         row.name,
    role:         row.role,
    age:          row.age ?? null,
    initials:     initialsFromName(row.name),
    avatarColour: palette,
  }
}

export function normalizeTripRow(row) {
  const total      = row.checklist_items?.length ?? 0
  const done       = row.checklist_items?.filter(i => i.checked).length ?? 0
  const travellers = (row.trip_travellers || []).map(t => t.member_id)

  return {
    id:          row.id,
    name:        row.destination,
    destination: row.destination,
    tripType:    row.trip_type,
    datesFrom:   row.dates_from,
    datesTo:     row.dates_to,
    weather:     row.weather,
    status:      row.status,
    travellers,
    total,
    done,
  }
}

function normalizeItem(item) {
  return {
    id:              item.id,
    label:           item.label,
    category:        item.category,
    checked:         item.checked,
    isAiSuggested:   item.is_ai_suggested,
    isManuallyAdded: item.is_manually_added,
    savedToTemplate: item.saved_to_template,
    sortOrder:       item.sort_order,
  }
}

export function normalizeTripDetail(row) {
  const members    = (row.trip_travellers || []).map(t => normalizeMember(t.household_members))
  const travellers = (row.trip_travellers || []).map(t => t.member_id)

  const checklists = {}
  ;(row.checklist_items || []).forEach(item => {
    if (!checklists[item.member_id]) checklists[item.member_id] = []
    checklists[item.member_id].push(normalizeItem(item))
  })
  Object.values(checklists).forEach(items =>
    items.sort((a, b) => a.sortOrder - b.sortOrder)
  )

  // Build AI suggestions: one entry per unique label across all members
  const seen = new Set()
  const aiSuggestions = []
  ;(row.checklist_items || [])
    .filter(i => i.is_ai_suggested)
    .forEach(item => {
      if (!seen.has(item.label)) {
        seen.add(item.label)
        aiSuggestions.push({
          label:      item.label,
          assignedTo: (row.checklist_items || [])
            .filter(i => i.label === item.label && i.is_ai_suggested)
            .map(i => i.member_id),
        })
      }
    })

  return {
    id:           row.id,
    name:         row.destination,
    destination:  row.destination,
    tripType:     row.trip_type,
    datesFrom:    row.dates_from,
    datesTo:      row.dates_to,
    weather:      row.weather,
    status:       row.status,
    travellers,
    members,
    checklists,
    aiSuggestions,
  }
}
