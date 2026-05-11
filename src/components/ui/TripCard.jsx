import { useState } from 'react'
import { Plane, Car, Moon } from 'lucide-react'
import { formatTripDates, describeTravellers } from '../../lib/utils'

// Color palette per trip, derived from id hash for consistency
const TILE_PALETTES = [
  { upcoming: { bg: '#3d6494', color: '#ffffff' }, completed: { bg: '#E6F1FB', color: '#185FA5' } },
  { upcoming: { bg: '#2a9d6e', color: '#ffffff' }, completed: { bg: '#E1F5EE', color: '#0F6E56' } },
  { upcoming: { bg: '#c47d1a', color: '#ffffff' }, completed: { bg: '#FAEEDA', color: '#854F0B' } },
  { upcoming: { bg: '#9b6b9b', color: '#ffffff' }, completed: { bg: '#F3E8F3', color: '#6B2F6B' } },
]

function paletteFromId(id = '') {
  let h = 0
  for (const c of String(id)) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return TILE_PALETTES[Math.abs(h) % TILE_PALETTES.length]
}

function iconFromTripType(tripType = '') {
  const lower = String(tripType).toLowerCase()
  if (lower.includes('flight') || lower.includes('abroad') || lower.includes('fly')) return Plane
  if (lower.includes('day') || lower.includes('drive') || lower.includes('local')) return Car
  if (lower.includes('weekend') || lower.includes('night') || lower.includes('away') || lower.includes('stay')) return Moon
  return Plane
}

export default function TripCard({ trip, members, onClick }) {
  const [hovered, setHovered] = useState(false)

  const isUpcoming  = trip.status === 'upcoming'
  const isClickable = isUpcoming

  const progress      = trip.total > 0 ? Math.round((trip.done / trip.total) * 100) : 0
  const dates         = formatTripDates(trip.datesFrom, trip.datesTo)
  const travellerDesc = describeTravellers(trip.travellers, members)
  const meta          = [dates, travellerDesc].filter(Boolean).join(' · ')

  const palette   = paletteFromId(trip.id)
  const tileStyle = palette[trip.status] ?? palette.upcoming
  const Icon      = iconFromTripType(trip.tripType)

  const borderColor = hovered && isClickable ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.08)'

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ border: `0.5px solid ${borderColor}`, transition: 'border-color 150ms' }}
      className={[
        'bg-white rounded-card px-4 py-[14px] mb-2 flex items-center gap-3',
        isClickable ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      {/* Icon tile 38×38 */}
      <div
        style={{ backgroundColor: tileStyle.bg, color: tileStyle.color, width: 38, height: 38, flexShrink: 0 }}
        className="rounded-input flex items-center justify-center"
      >
        <Icon size={18} />
      </div>

      {/* Name + meta + progress */}
      <div className="flex-1 min-w-0">
        <p className="text-14 font-medium text-content-primary truncate leading-snug">
          {trip.name}
        </p>
        {meta && (
          <p className="text-12 text-content-secondary mt-0.5 truncate">{meta}</p>
        )}
        {isUpcoming && (
          <div className="mt-1.5 h-1 bg-surface rounded-full overflow-hidden" style={{ width: 48 }}>
            <div
              className="h-full bg-success rounded-full"
              style={{ width: `${progress}%`, transition: 'width 600ms ease-out' }}
            />
          </div>
        )}
      </div>

      {/* Status badge */}
      {isUpcoming ? (
        <span className="flex-shrink-0 px-2 py-0.5 bg-amber-light text-amber-dark rounded-pill text-11 font-medium whitespace-nowrap">
          {progress}%
        </span>
      ) : (
        <span className="flex-shrink-0 px-2 py-0.5 bg-surface text-content-secondary rounded-pill text-11 font-medium whitespace-nowrap">
          Done
        </span>
      )}
    </div>
  )
}
