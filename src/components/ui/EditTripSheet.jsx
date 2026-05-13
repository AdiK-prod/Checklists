import { useState, useRef, useEffect } from 'react'
import BottomSheet from './BottomSheet'
import { fetchWeather, setCachedWeather } from '../../lib/weatherService'
import { updateTrip } from '../../lib/tripService'

/**
 * @param {{ open: boolean, trip: object|null, onClose: () => void, onSaved: (updatedTrip: object) => void }} props
 */
export default function EditTripSheet({ open, trip, onClose, onSaved }) {
  const [form, setForm]             = useState({ name: '', destination: '', datesFrom: '', datesTo: '', tripType: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const weatherDebounceRef          = useRef(null)
  const pendingForecastRef          = useRef(null) // { location, forecast } captured silently

  useEffect(() => {
    if (!open || !trip) return
    setForm({
      name:        trip.name        || '',
      destination: trip.destination || '',
      datesFrom:   trip.datesFrom   || '',
      datesTo:     trip.datesTo     || '',
      tripType:    trip.tripType    || trip.trip_type || '',
    })
    pendingForecastRef.current = null
    setError(null)
  }, [open, trip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerWeatherFetch = (destination, datesFrom, datesTo) => {
    if (weatherDebounceRef.current) clearTimeout(weatherDebounceRef.current)
    pendingForecastRef.current = null
    if (!destination.trim()) return
    weatherDebounceRef.current = setTimeout(async () => {
      try {
        const { location, forecast } = await fetchWeather({
          destination: destination.trim(),
          dateFrom: datesFrom,
          dateTo:   datesTo,
        })
        if (forecast?.length) {
          pendingForecastRef.current = { location, forecast }
        }
      } catch {
        // Silent — weather is non-blocking
      }
    }, 500)
  }

  const handleChange = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'destination' || key === 'datesFrom' || key === 'datesTo') {
        triggerWeatherFetch(
          key === 'destination' ? value : next.destination,
          key === 'datesFrom'   ? value : next.datesFrom,
          key === 'datesTo'     ? value : next.datesTo,
        )
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!trip?.id) return
    setSaving(true)
    setError(null)
    try {
      const pending = pendingForecastRef.current
      const patch = {
        name:        form.name.trim() || form.destination.trim(),
        destination: form.destination.trim(),
        datesFrom:   form.datesFrom,
        datesTo:     form.datesTo,
        tripType:    form.tripType.trim(),
        ...(pending ? { weather: { forecast: pending.forecast } } : {}),
      }

      await updateTrip(trip.id, patch)

      if (pending) {
        setCachedWeather(trip.id, pending.location, pending.forecast)
      }

      onSaved({ ...trip, ...patch })
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full text-btn text-content-primary rounded-input px-3 py-[10px] bg-white border border-[#e0ddd8] focus:outline-none focus:border-navy'

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit trip">
      <div className="space-y-3 pb-4">
        <div>
          <p className="text-13 text-content-secondary mb-1">Trip name</p>
          <input
            type="text"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder={form.destination || 'Trip name'}
            className={inputCls}
          />
        </div>

        <div>
          <p className="text-13 text-content-secondary mb-1">Destination</p>
          <input
            type="text"
            value={form.destination}
            onChange={e => handleChange('destination', e.target.value)}
            placeholder="e.g. Barcelona, Spain"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-13 text-content-secondary mb-1">From</p>
            <input
              type="date"
              value={form.datesFrom}
              onChange={e => handleChange('datesFrom', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-13 text-content-secondary mb-1">To</p>
            <input
              type="date"
              value={form.datesTo}
              onChange={e => handleChange('datesTo', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <p className="text-13 text-content-secondary mb-1">Trip type <span className="text-content-hint">(optional)</span></p>
          <input
            type="text"
            value={form.tripType}
            onChange={e => handleChange('tripType', e.target.value)}
            placeholder="e.g. Beach + city"
            className={inputCls}
          />
        </div>

        {error && <p className="text-13" style={{ color: '#c03434' }}>{error}</p>}

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full bg-navy text-white rounded-button py-3 text-btn font-medium disabled:opacity-60 mt-2"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </BottomSheet>
  )
}
