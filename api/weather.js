const WMO = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Rain showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail',
}

function wmoCondition(code) {
  return WMO[code] ?? 'Mixed conditions'
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.end(JSON.stringify(data))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })

  const { destination, dateFrom, dateTo } = req.query
  if (!destination) return sendJson(res, 400, { error: 'Missing destination' })

  try {
    // Step 1: Geocode
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`,
    )
    if (!geoRes.ok) return sendJson(res, 502, { error: 'Geocoding service unavailable' })
    const geoData = await geoRes.json()
    if (!geoData.results?.length) return sendJson(res, 404, { error: 'City not found' })

    const { latitude, longitude, name, country } = geoData.results[0]
    const location = `${name}, ${country}`

    // Step 2: Determine forecast window
    const today = new Date()
    const from  = dateFrom ? new Date(`${dateFrom}T00:00:00`) : today
    const to    = dateTo   ? new Date(`${dateTo}T00:00:00`)   : from

    // Past trips — return empty forecast
    if (to < today) {
      return sendJson(res, 200, { location, forecast: [] })
    }

    const days = Math.min(16, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1)

    // Step 3: Fetch forecast from Open-Meteo
    const wxUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&timezone=auto` +
      `&forecast_days=${days}`

    const wxRes = await fetch(wxUrl)
    if (!wxRes.ok) return sendJson(res, 502, { error: 'Weather service unavailable' })
    const wxData = await wxRes.json()

    const daily = wxData.daily
    const forecast = (daily?.time || []).map((date, i) => ({
      date,
      tempMin:   Math.round(daily.temperature_2m_min?.[i] ?? 0),
      tempMax:   Math.round(daily.temperature_2m_max?.[i] ?? 0),
      condition: wmoCondition(daily.weathercode?.[i]),
    }))

    // Return structured JSON only — no AI, no free text
    sendJson(res, 200, { location, forecast })
  } catch (e) {
    sendJson(res, 500, { error: e.message || 'Failed to fetch weather' })
  }
}
