import { asArray } from './transforms'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CATEGORY_ORDER = ['Documents','Clothing','Essentials','Toiletries','Entertainment','Medications','Other']

/**
 * Format a date range into a compact label.
 * Same month:  "Jul 14–21"
 * Single day:  "Jun 20"
 * Cross-month: "Dec 28 – Jan 3"
 */
export function formatTripDates(from, to) {
  if (!from) return ''
  const d1 = new Date(from + 'T00:00:00')
  const d2 = to ? new Date(to + 'T00:00:00') : d1

  if (!to || from === to) {
    return `${MONTHS[d1.getMonth()]} ${d1.getDate()}`
  }
  if (d1.getMonth() === d2.getMonth()) {
    return `${MONTHS[d1.getMonth()]} ${d1.getDate()}–${d2.getDate()}`
  }
  return `${MONTHS[d1.getMonth()]} ${d1.getDate()} – ${MONTHS[d2.getMonth()]} ${d2.getDate()}`
}

/**
 * Compute overall checklist progress (0–100) across all member lists.
 */
export function computeProgress(checklists) {
  let total = 0
  let checked = 0
  Object.values(checklists || {}).forEach(items => {
    asArray(items).forEach(item => {
      total++
      if (item.checked) checked++
    })
  })
  return total === 0 ? 0 : Math.round((checked / total) * 100)
}

/**
 * Compute the number of nights between two date strings.
 */
export function computeNights(from, to) {
  if (!from || !to) return 0
  const d1 = new Date(from + 'T00:00:00')
  const d2 = new Date(to + 'T00:00:00')
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
}

/**
 * Group checklist items by category, in the canonical order.
 * Returns: [{ category, items }]
 */
export function groupByCategory(items) {
  const map = {}
  asArray(items).forEach(item => {
    const cat = item.category || 'Other'
    if (!map[cat]) map[cat] = []
    map[cat].push(item)
  })
  return CATEGORY_ORDER
    .filter(cat => map[cat])
    .map(cat => ({ category: cat, items: map[cat].sort((a, b) => a.sortOrder - b.sortOrder) }))
}

/**
 * Describe the traveller mix for a trip.
 * e.g. "2 adults · 2 kids" or "3 adults"
 */
export function describeTravellers(travellerIds, members) {
  const ids = asArray(travellerIds)
  const travellers = asArray(members).filter(m => ids.includes(m.id))
  const parents = travellers.filter(m => m.role === 'parent')
  const kids    = travellers.filter(m => m.role === 'kid')

  if (travellers.length === 0) return ''
  if (kids.length === 0) return `${parents.length} adult${parents.length !== 1 ? 's' : ''}`
  if (parents.length === 0) return `${kids.length} kid${kids.length !== 1 ? 's' : ''}`
  return `${parents.length} adult${parents.length !== 1 ? 's' : ''} · ${kids.length} kid${kids.length !== 1 ? 's' : ''}`
}
