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
      'w-full text-btn text-content-primary rounded-input px-3 py-[10px] bg-white focus:outline-none',
      hasErr ? 'border border-[#e05454]' : 'border border-[#e0ddd8] focus:border-navy',
    ].join(' ')

  return (
    <div className="pt-1 flex flex-col min-h-0">
      <p className="text-track-label font-medium uppercase text-content-secondary tracking-[0.05em] mb-2">
        Trip details
      </p>

      <div className="space-y-2.5 min-h-0">
        <div>
          <p className="text-13 text-content-secondary mb-1">Destination</p>
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
            <p className="text-13 text-content-secondary mb-1">From</p>
            <input
              type="date"
              value={datesFrom}
              onChange={e => onChange('datesFrom', e.target.value)}
              className={inputCls(!!errors.dates)}
            />
          </div>
          <div>
            <p className="text-13 text-content-secondary mb-1">To</p>
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

        <div>
          <p className="text-13 text-content-secondary mb-1">Trip type <span className="text-content-hint font-normal">(optional)</span></p>
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
