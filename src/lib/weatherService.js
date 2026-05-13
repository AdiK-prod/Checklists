/**
 * Client-side weather service.
 * Calls /api/weather (wraps Open-Meteo) with a localStorage cache.
 *
 * Cache shape:
 *   localStorage['weatherCache'] = JSON.stringify({
 *     [tripId]: { fetchedAt: ISO, location: string, forecast: [{date,tempMin,tempMax,condition}] }
 *   })
 */

const CACHE_KEY   = 'weatherCache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 h

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* quota exceeded — silently ignore */ }
}

/**
 * Return cached forecast for a trip if it is from today.
 * @param {string} tripId
 * @returns {{ location: string, forecast: object[] } | null}
 */
export function getCachedWeather(tripId) {
  const cache = readCache()
  const entry = cache[tripId]
  if (!entry) return null
  const fetchedAt = new Date(entry.fetchedAt)
  const now = new Date()
  if (
    fetchedAt.getFullYear() !== now.getFullYear() ||
    fetchedAt.getMonth()   !== now.getMonth()     ||
    fetchedAt.getDate()    !== now.getDate()
  ) return null
  return { location: entry.location, forecast: entry.forecast }
}

/**
 * Store forecast in cache.
 * @param {string} tripId
 * @param {string} location
 * @param {object[]} forecast
 */
export function setCachedWeather(tripId, location, forecast) {
  const cache = readCache()
  cache[tripId] = { fetchedAt: new Date().toISOString(), location, forecast }
  writeCache(cache)
}

/**
 * Fetch weather from /api/weather.
 * @param {{ destination: string, dateFrom?: string, dateTo?: string }} opts
 * @returns {Promise<{ location: string, forecast: { date: string, tempMin: number, tempMax: number, condition: string }[] }>}
 */
export async function fetchWeather({ destination, dateFrom, dateTo }) {
  const params = new URLSearchParams({ destination })
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo)   params.set('dateTo', dateTo)

  const res = await fetch(`/api/weather?${params.toString()}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Weather fetch failed')
  return { location: data.location, forecast: data.forecast || [] }
}

/**
 * Build a structured weather object from a forecast array (used to auto-populate
 * wizard fields from an API response).
 * @param {object[]} forecast
 * @returns {{ tempMin: number|null, tempMax: number|null, condition: string }}
 */
export function forecastToWeatherFields(forecast) {
  if (!forecast?.length) return { tempMin: '', tempMax: '', condition: '' }
  const mins  = forecast.map(d => d.tempMin).filter(v => v != null)
  const maxes = forecast.map(d => d.tempMax).filter(v => v != null)

  // Most frequent condition
  const freq = {}
  for (const d of forecast) freq[d.condition] = (freq[d.condition] || 0) + 1
  const condition = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  return {
    tempMin: mins.length  ? Math.min(...mins)  : '',
    tempMax: maxes.length ? Math.max(...maxes) : '',
    condition,
  }
}

/**
 * Summarise a long forecast into a single-line description.
 * @param {object[]} forecast
 * @returns {string}
 */
export function forecastSummaryLine(forecast) {
  if (!forecast?.length) return ''
  const { tempMin, tempMax, condition } = forecastToWeatherFields(forecast)
  const parts = []
  if (tempMin !== '' && tempMax !== '') parts.push(`${tempMin}–${tempMax}°C range`)
  if (condition) parts.push(condition)
  return parts.join(' · ')
}

/**
 * Fetch weather for all upcoming trips that need refreshing and cache results.
 * Fetches sequentially with a 100ms gap to avoid hammering the API.
 * @param {Array<{ id: string, destination: string, datesFrom: string, datesTo: string, status: string }>} trips
 */
export async function refreshWeatherForUpcomingTrips(trips) {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = (trips || []).filter(t =>
    t.status === 'upcoming' && t.datesTo >= today && t.destination,
  )

  for (const trip of upcoming) {
    if (getCachedWeather(trip.id)) continue
    try {
      const { location, forecast } = await fetchWeather({
        destination: trip.destination,
        dateFrom:    trip.datesFrom,
        dateTo:      trip.datesTo,
      })
      setCachedWeather(trip.id, location, forecast)
    } catch {
      // Non-fatal — stale or missing weather is acceptable
    }
    await new Promise(r => setTimeout(r, 100))
  }
}
