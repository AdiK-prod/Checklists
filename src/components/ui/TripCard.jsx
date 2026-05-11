import { useState } from 'react'
import { Plane, Car, Moon } from 'lucide-react'
import { formatTripDates, computeProgress, describeTravellers } from '../../lib/utils'

// Icon + colour config by templateId and status
const TILE_CONFIG = {
  'template-flight': {
    Icon: Plane,
    upcoming:  { bg: '#3d6494', color: '#ffffff' },
    completed: { bg: '#E6F1FB', color: '#185FA5' },
  },
  'template-day': {
    Icon: Car,
    upcoming:  { bg: '#E1F5EE', color: '#0F6E56' },
    completed: { bg: '#E1F5EE', color: '#0F6E56' },
  },
  'template-weekend': {
    Icon: Moon,
    upcoming:  { bg: '#FAEEDA', color: '#854F0B' },
    completed: { bg: '#FAEEDA', color: '#854F0B' },
  },
}

export default function TripCard({ trip, members, onClick }) {
  const [hovered, setHovered] = useState(false)

  const isUpcoming  = trip.status === 'upcoming'
  const isClickable = isUpcoming

  const progress     = computeProgress(trip.checklists)
  const dates        = formatTripDates(trip.datesFrom, trip.datesTo)
  const travellerDesc = describeTravellers(trip.travellers, members)
  const meta         = [dates, travellerDesc].filter(Boolean).join(' · ')

  const config   = TILE_CONFIG[trip.templateId] ?? TILE_CONFIG['template-flight']
  const tileStyle = config[trip.status] ?? config.upcoming
  const { Icon } = config

  const borderColor = hovered && isClickable
    ? 'rgba(0,0,0,0.16)'
    : 'rgba(0,0,0,0.08)'

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
      {/* Left: icon tile 38×38, radius 8px */}
      <div
        style={{ backgroundColor: tileStyle.bg, color: tileStyle.color, width: 38, height: 38, flexShrink: 0 }}
        className="rounded-input flex items-center justify-center"
      >
        <Icon size={18} />
      </div>

      {/* Centre: name + meta + progress bar */}
      <div className="flex-1 min-w-0">
        <p className="text-14 font-medium text-content-primary truncate leading-snug">
          {trip.name}
        </p>
        {meta && (
          <p className="text-12 text-content-secondary mt-0.5 truncate">
            {meta}
          </p>
        )}
        {/* Mini progress bar — upcoming only, 48px × 4px */}
        {isUpcoming && (
          <div className="mt-1.5 h-1 bg-surface rounded-full overflow-hidden" style={{ width: 48 }}>
            <div
              className="h-full bg-success rounded-full"
              style={{ width: `${progress}%`, transition: 'width 600ms ease-out' }}
            />
          </div>
        )}
      </div>

      {/* Right: status badge */}
      {isUpcoming ? (
        <span
          className="flex-shrink-0 px-2 py-0.5 bg-amber-light text-amber-dark rounded-pill text-11 font-medium"
          style={{ whiteSpace: 'nowrap' }}
        >
          {progress}%
        </span>
      ) : (
        <span
          className="flex-shrink-0 px-2 py-0.5 bg-surface text-content-secondary rounded-pill text-11 font-medium"
          style={{ whiteSpace: 'nowrap' }}
        >
          Done
        </span>
      )}
    </div>
  )
}
