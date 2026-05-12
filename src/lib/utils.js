const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
 * True if a trip should appear under "past" (completed status, or end date before today in local time).
 */
export function isTripPast(trip) {
  if (!trip) return false
  if (trip.status === 'completed') return true
  const to = trip.datesTo
  if (!to || typeof to !== 'string') return false
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return to < todayStr
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
 * Describe the traveller mix for a trip.
 * e.g. "2 adults · 2 kids" or "3 adults"
 */
export function describeTravellers(travellerIds, members) {
  const ids = Array.isArray(travellerIds) ? travellerIds : []
  const travellers = Array.isArray(members) ? members.filter(m => ids.includes(m.id)) : []
  const parents = travellers.filter(m => m.role === 'parent')
  const kids    = travellers.filter(m => m.role === 'kid')

  if (travellers.length === 0) return ''
  if (kids.length === 0) return `${parents.length} adult${parents.length !== 1 ? 's' : ''}`
  if (parents.length === 0) return `${kids.length} kid${kids.length !== 1 ? 's' : ''}`
  return `${parents.length} adult${parents.length !== 1 ? 's' : ''} · ${kids.length} kid${kids.length !== 1 ? 's' : ''}`
}
