import { weatherOutlookLines, buildTripDayWeatherOutlook } from '../../lib/tripWeatherSummary'

export default function Step3Details({
  destination,
  datesFrom,
  datesTo,
  tripType,
  onChange,
  errors = {},
}) {
  const inputCls = (hasErr) =>
    [
      'w-full text-14 text-content-primary rounded-input px-3 py-[10px] bg-white focus:outline-none',
      hasErr ? 'border border-[#e05454]' : 'border border-[#e0ddd8] focus:border-navy',
    ].join(' ')

  const outlook = buildTripDayWeatherOutlook(datesFrom, datesTo)
  const lines = weatherOutlookLines(datesFrom, datesTo, { maxLines: 4 })

  return (
    <div className="pt-1 flex flex-col min-h-0">
      <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">
        Trip details
      </p>

      <div className="space-y-2.5 min-h-0">
        <div>
          <p className="text-12 text-content-secondary mb-1">Destination</p>
          <input
            type="text"
            value={destination}
            onChange={e => onChange('destination', e.target.value)}
            placeholder="e.g. Barcelona, Spain"
            className={inputCls(!!errors.destination)}
          />
          {errors.destination && (
            <p className="text-11 mt-1" style={{ color: '#c03434' }}>{errors.destination}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-12 text-content-secondary mb-1">From</p>
            <input
              type="date"
              value={datesFrom}
              onChange={e => onChange('datesFrom', e.target.value)}
              className={inputCls(!!errors.dates)}
            />
          </div>
          <div>
            <p className="text-12 text-content-secondary mb-1">To</p>
            <input
              type="date"
              value={datesTo}
              onChange={e => onChange('datesTo', e.target.value)}
              className={inputCls(!!errors.dates)}
            />
          </div>
        </div>
        {errors.dates && (
          <p className="text-11 -mt-1" style={{ color: '#c03434' }}>{errors.dates}</p>
        )}

        {outlook && (
          <div
            className="rounded-input px-3 py-2.5 bg-white"
            style={{ border: '0.5px solid rgba(61,100,148,0.25)' }}
          >
            <p className="text-12 font-medium text-content-primary mb-1">
              Weather outlook by day
            </p>
            <p className="text-11 text-content-secondary mb-2">
              {outlook.days.length} day{outlook.days.length !== 1 ? 's' : ''} · northern hemisphere seasons (flip if you cross the equator)
            </p>
            <ul className="space-y-1.5">
              {lines.map((line, i) => (
                <li key={i} className="text-11 text-content-primary leading-snug pl-3" style={{ borderLeft: '2px solid #3d6494' }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-12 text-content-secondary mb-1">Trip type <span className="text-content-hint font-normal">(optional)</span></p>
          <input
            type="text"
            value={tripType}
            onChange={e => onChange('tripType', e.target.value)}
            placeholder="e.g. Beach + city"
            className={inputCls(false)}
          />
        </div>
      </div>
    </div>
  )
}
