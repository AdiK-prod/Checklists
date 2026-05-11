export default function Step3Details({
  destination,
  datesFrom,
  datesTo,
  weather,
  tripType,
  onChange,
  errors = {},
}) {
  const inputCls = (hasErr) =>
    [
      'w-full text-14 text-content-primary rounded-input px-3 py-[10px] bg-white focus:outline-none',
      hasErr ? 'border border-[#e05454]' : 'border border-[#e0ddd8] focus:border-navy',
    ].join(' ')

  return (
    <div className="pt-1">
      <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-3">
        Trip details
      </p>

      <div className="space-y-3">
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
          <p className="text-11 -mt-2" style={{ color: '#c03434' }}>{errors.dates}</p>
        )}

        <div>
          <p className="text-12 text-content-secondary mb-1">Expected weather</p>
          <input
            type="text"
            value={weather}
            onChange={e => onChange('weather', e.target.value)}
            placeholder="e.g. Hot & sunny ~28°C"
            className={inputCls(!!errors.weather)}
          />
          {errors.weather && (
            <p className="text-11 mt-1" style={{ color: '#c03434' }}>{errors.weather}</p>
          )}
        </div>

        <div>
          <p className="text-12 text-content-secondary mb-1">Trip type</p>
          <input
            type="text"
            value={tripType}
            onChange={e => onChange('tripType', e.target.value)}
            placeholder="e.g. Beach + city"
            className={inputCls(!!errors.tripType)}
          />
          {errors.tripType && (
            <p className="text-11 mt-1" style={{ color: '#c03434' }}>{errors.tripType}</p>
          )}
        </div>
      </div>
    </div>
  )
}
