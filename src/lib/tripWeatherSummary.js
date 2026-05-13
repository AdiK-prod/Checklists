/**
 * Weather utilities — replaced in v2 with structured weather support.
 *
 * `trips.weather` is now jsonb with shape:
 *   { tempMin?: number, tempMax?: number, condition?: string }  ← new structured
 *   { raw: string }                                            ← migrated legacy text
 *
 * A value of null means no weather data yet.
 */

/** @typedef {{ tempMin?: number, tempMax?: number, condition?: string, raw?: string } | null} WeatherData */

/**
 * Parse whatever is stored in trips.weather into a normalized object.
 * Handles: null, plain string (should not appear after migration), {raw}, {tempMin,...}
 * @param {*} raw - value from DB (already parsed from jsonb by Supabase client)
 * @returns {WeatherData}
 */
export function parseWeather(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed)
      return parsed
    } catch {
      return { raw: trimmed }
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

/**
 * Return true if the weather object has structured fields (not just a raw string).
 * @param {WeatherData} w
 */
export function isStructuredWeather(w) {
  if (!w) return false
  return w.tempMin != null || w.tempMax != null || w.condition != null
}

/**
 * Format structured weather for a one-line summary string (used in hero pill, etc.)
 * @param {WeatherData} w
 * @returns {string}
 */
export function weatherSummaryLine(w) {
  if (!w) return ''
  if (w.raw) return w.raw
  const parts = []
  if (w.tempMin != null && w.tempMax != null) parts.push(`${w.tempMin}–${w.tempMax}°C`)
  else if (w.tempMax != null) parts.push(`${w.tempMax}°C`)
  else if (w.tempMin != null) parts.push(`${w.tempMin}°C`)
  if (w.condition) parts.push(w.condition)
  return parts.join(' · ')
}

/**
 * Build a structured weather object from user-entered wizard fields.
 * @param {{ tempMin: string, tempMax: string, condition: string }} fields
 * @returns {WeatherData | null}
 */
export function buildWeatherFromFields(fields) {
  const { tempMin, tempMax, condition } = fields || {}
  const min = tempMin !== '' && tempMin != null ? Number(tempMin) : undefined
  const max = tempMax !== '' && tempMax != null ? Number(tempMax) : undefined
  const cond = typeof condition === 'string' ? condition.trim() : ''
  if (min == null && max == null && !cond) return null
  return {
    ...(min != null && !isNaN(min) ? { tempMin: min } : {}),
    ...(max != null && !isNaN(max) ? { tempMax: max } : {}),
    ...(cond ? { condition: cond } : {}),
  }
}

// ---------------------------------------------------------------------------
// Legacy helpers kept for backward compatibility (used in existing trip data)
// ---------------------------------------------------------------------------

function seasonBand(monthIndex) {
  if (monthIndex === 11 || monthIndex <= 1) return { season: 'Winter', hint: 'cool to cold; layers & waterproofs' }
  if (monthIndex >= 2 && monthIndex <= 4) return { season: 'Spring', hint: 'mild; mix of sun and showers' }
  if (monthIndex >= 5 && monthIndex <= 7) return { season: 'Summer', hint: 'warm; sun protection & lighter clothes' }
  return { season: 'Autumn', hint: 'cooling; layers and rain-ready gear' }
}

function parseLocalMidday(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null
  const d = new Date(`${isoDate}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildTripDayWeatherOutlook(datesFrom, datesTo) {
  const start = parseLocalMidday(datesFrom)
  const end = parseLocalMidday(datesTo)
  if (!start || !end || end < start) return null
  const days = []
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t)
    const m = d.getMonth()
    const { season, hint } = seasonBand(m)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    days.push({
      iso: `${y}-${mo}-${dy}`,
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      season,
      hint,
    })
  }
  return { start, end, days }
}
