// DEMO SCAFFOLDING — static display fields in Level 1.
// Module 9 replaces these with real editable inputs wired to wizard state.

const FIELDS = [
  { label: 'Destination',       value: 'Barcelona, Spain'    },
  { label: 'Dates',             value: 'Jul 14–21 2026'      },
  { label: 'Expected weather',  value: 'Hot & sunny ~28°C'   },
  { label: 'Trip type',         value: 'Beach + city'        },
]

export default function Step3Details() {
  return (
    <div className="pt-1">
      <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-3">
        Trip details
      </p>

      <div className="space-y-3">
        {FIELDS.map(({ label, value }) => (
          <div key={label}>
            <p className="text-12 text-content-secondary mb-1">{label}</p>
            <div
              className="text-14 text-content-primary rounded-input px-3 py-[10px] bg-white"
              style={{ border: '0.5px solid #e0ddd8' }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
