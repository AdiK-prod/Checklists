/**
 * Northern-hemisphere seasonal hints by month (0 = Jan). User can mentally
 * flip for southern hemisphere; copy mentions that when relevant.
 */
function seasonBand(monthIndex) {
  if (monthIndex === 11 || monthIndex <= 1) {
    return { season: 'Winter', hint: 'cool to cold; layers & waterproofs' }
  }
  if (monthIndex >= 2 && monthIndex <= 4) {
    return { season: 'Spring', hint: 'mild; mix of sun and showers' }
  }
  if (monthIndex >= 5 && monthIndex <= 7) {
    return { season: 'Summer', hint: 'warm; sun protection & lighter clothes' }
  }
  return { season: 'Autumn', hint: 'cooling; layers and rain-ready gear' }
}

function parseLocalMidday(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null
  const d = new Date(`${isoDate}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function localIsoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * @param {string} datesFrom - yyyy-mm-dd
 * @param {string} datesTo
 * @returns {{ start: Date, end: Date, days: Array<{ iso: string, weekday: string, dayLabel: string, season: string, hint: string }> } | null}
 */
export function buildTripDayWeatherOutlook(datesFrom, datesTo) {
  const start = parseLocalMidday(datesFrom)
  const end = parseLocalMidday(datesTo)
  if (!start || !end || end < start) return null

  const days = []
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t)
    const m = d.getMonth()
    const { season, hint } = seasonBand(m)
    days.push({
      iso: localIsoDate(d),
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      season,
      hint,
    })
  }
  return { start, end, days }
}

/**
 * Short lines for UI (caps list length on long trips).
 * @param {string} datesFrom
 * @param {string} datesTo
 * @param {{ maxLines?: number }} [opts]
 * @returns {string[]}
 */
export function weatherOutlookLines(datesFrom, datesTo, opts = {}) {
  const maxLines = opts.maxLines ?? 5
  const built = buildTripDayWeatherOutlook(datesFrom, datesTo)
  if (!built) return []

  const { days } = built
  if (days.length === 0) return []

  const fixed = days.map(
    (d) => `${d.weekday} ${d.dayLabel}: typical ${d.season.toLowerCase()} — ${d.hint}`
  )

  if (fixed.length <= maxLines) return fixed

  const head = fixed.slice(0, maxLines - 1)
  const rest = fixed.length - (maxLines - 1)
  return [
    ...head,
    `+ ${rest} more day${rest !== 1 ? 's' : ''} (same outlook pattern for those dates).`,
  ]
}

/**
 * Single string stored on `trips.weather` and sent to the AI suggest API.
 */
export function weatherSummaryForTrip(datesFrom, datesTo) {
  const built = buildTripDayWeatherOutlook(datesFrom, datesTo)
  if (!built) return ''

  const { days } = built
  if (days.length === 0) return ''

  const range = `${days.length} day${days.length !== 1 ? 's' : ''} (${days[0].iso} → ${days[days.length - 1].iso})`
  const byDay = days
    .map((d) => `${d.iso} (${d.weekday}): ${d.season}, ${d.hint}`)
    .join('. ')

  return (
    `${range}. Expected conditions by day (northern-hemisphere seasonal guide; adjust if south of the equator): ${byDay}`
  )
}
