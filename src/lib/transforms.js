// Data normalisation — converts snake_case Supabase rows to camelCase UI shapes.
// All DB access goes through hooks in /src/hooks/; transforms live here.

/** PostgREST usually returns arrays for embeds; coerce single objects so .filter/.map never break. */
export function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

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
    id: row.id,
    name: row.name,
    role: row.role,
    age: row.age ?? null,
    initials: initialsFromName(row.name),
    avatarColour: palette,
  }
}

export function normalizeTripRow(row) {
  const tripTravellers = asArray(row.trip_travellers)
  const sections = asArray(row.checklist_sections)
  let total = 0
  let done = 0
  for (const sec of sections) {
    const subs = asArray(sec.checklist_subcategories)
    for (const sub of subs) {
      for (const i of asArray(sub.checklist_items)) {
        total++
        if (i.checked) done++
      }
    }
  }
  const travellers = tripTravellers.map(t => t.member_id)

  return {
    id: row.id,
    name: row.destination,
    destination: row.destination,
    tripType: row.trip_type,
    datesFrom: row.dates_from,
    datesTo: row.dates_to,
    weather: row.weather,
    status: row.status,
    travellers,
    total,
    done,
  }
}

export function normalizeItem(item) {
  return {
    id: item.id,
    subcategoryId: item.subcategory_id,
    label: item.label,
    checked: item.checked,
    isAiSuggested: item.is_ai_suggested,
    isManuallyAdded: item.is_manually_added,
    savedToTemplate: item.saved_to_template,
    sortOrder: item.sort_order,
  }
}

export function normalizeSubcategory(row, items) {
  const arr = asArray(items)
    .map(normalizeItem)
    .sort(
      (a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.label).localeCompare(String(b.label)),
    )
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isManuallyAdded: row.is_manually_added,
    items: arr,
  }
}

function travellersMembersFromRow(tripRow) {
  const tripTravellers = asArray(tripRow.trip_travellers)
  return tripTravellers.map(t => {
    const hm = t.household_members
    if (hm && !Array.isArray(hm) && hm.id) return normalizeMember(hm)
    const hmRow = Array.isArray(hm) ? hm[0] : hm
    if (hmRow?.id) return normalizeMember(hmRow)
    return normalizeMember({
      id: t.member_id,
      name: 'Traveller',
      role: 'parent',
      age: null,
    })
  })
}

export function buildSectionsTree(sectionRows, subcatRows, itemRows) {
  const bySection = new Map()
  const sortedSections = [...asArray(sectionRows)].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  for (const s of sortedSections) {
    const node = {
      id: s.id,
      sectionType: s.section_type,
      name: s.name,
      memberId: s.member_id,
      sortOrder: s.sort_order,
      member: null,
      subcategories: [],
    }
    bySection.set(s.id, node)
  }

  const bySub = new Map()
  const sortedSubs = [...asArray(subcatRows)].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  for (const sc of sortedSubs) {
    const sec = bySection.get(sc.section_id)
    if (!sec) continue
    const subNode = { ...sc, items: [] }
    sec.subcategories.push(subNode)
    bySub.set(sc.id, subNode)
  }

  for (const it of asArray(itemRows)) {
    const sub = bySub.get(it.subcategory_id)
    if (sub) sub.items.push(it)
  }

  const list = sortedSections.map(s => bySection.get(s.id)).filter(Boolean)
  return { list, bySection, bySub }
}

export function attachMembersToSections(sectionsList, members) {
  const mid = new Map(members.map(m => [m.id, m]))
  for (const sec of sectionsList) {
    if (sec.sectionType === 'person' && sec.memberId) {
      sec.member = mid.get(sec.memberId) || null
    }
  }
}

export function buildAiSuggestionsFromSections(sectionsList, travellerIds) {
  const byLabel = new Map()
  for (const sec of sectionsList) {
    for (const sub of sec.subcategories || []) {
      for (const item of sub.items || []) {
        if (!item.isAiSuggested) continue
        const set = byLabel.get(item.label) || new Set()
        if (sec.sectionType === 'shared') {
          travellerIds.forEach(id => set.add(id))
        } else if (sec.memberId) {
          set.add(sec.memberId)
        }
        byLabel.set(item.label, set)
      }
    }
  }
  return [...byLabel.entries()].map(([label, set]) => ({
    label,
    assignedTo: [...set],
  }))
}

/**
 * @param {object} tripRow — trips row + trip_travellers embed (with household_members)
 * @param {object[]} sectionsList — normalised section tree (raw snake_case subcats/items ok)
 */
export function normalizeTripDetail(tripRow, sectionsList) {
  const tripTravellers = asArray(tripRow.trip_travellers)
  const travellers = tripTravellers.map(t => t.member_id)
  const members = travellersMembersFromRow(tripRow)

  const subNorm = sectionsList.map(sec => ({
    ...sec,
    subcategories: (sec.subcategories || []).map(sub =>
      normalizeSubcategory(sub, sub.items),
    ),
  }))

  const aiSuggestions = buildAiSuggestionsFromSections(subNorm, travellers)

  return {
    id: tripRow.id,
    name: tripRow.destination,
    destination: tripRow.destination,
    tripType: tripRow.trip_type,
    templateId: tripRow.template_id,
    datesFrom: tripRow.dates_from,
    datesTo: tripRow.dates_to,
    weather: tripRow.weather,
    status: tripRow.status,
    travellers,
    members,
    sections: subNorm,
    aiSuggestions,
  }
}
