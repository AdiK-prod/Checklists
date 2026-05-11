import { Sparkles, Check } from 'lucide-react'

export default function Step4Suggestions({ suggestions, members, subtitle, onToggle, onToggleAssign, onToggleAll }) {
  const getMemberName = (id) => members.find(m => m.id === id)?.name ?? id

  return (
    <div className="pt-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} style={{ color: '#c47d1a' }} />
        <span className="text-14 font-medium text-content-primary">Suggested additions</span>
      </div>
      <p className="text-12 text-content-secondary mb-4">{subtitle}</p>

      <div className="space-y-2">
        {suggestions.map(sugg => {
          const allSelected = sugg.memberIds.length > 0 &&
            sugg.memberIds.every(id => sugg.assignedTo.includes(id))

          return (
            <div
              key={sugg.id}
              className="bg-white rounded-card px-[14px] py-[13px]"
              style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
            >
              {/* Top row: checkbox + label + badge + reason */}
              <div className="flex items-start gap-2.5">
                {/* Checkbox 20×20 */}
                <div
                  onClick={() => onToggle(sugg.id)}
                  className={[
                    'w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer',
                    sugg.checked ? 'bg-success' : '',
                  ].join(' ')}
                  style={!sugg.checked ? { border: '1.5px solid rgba(0,0,0,0.2)' } : {}}
                >
                  {sugg.checked && <Check size={12} color="white" strokeWidth={3} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="text-14 font-medium text-content-primary">{sugg.label}</span>
                    {sugg.personSpecificNote && (
                      <span
                        className="text-11 px-2 py-0.5 rounded-pill"
                        style={{ backgroundColor: '#FAECE7', color: '#993C1D' }}
                      >
                        {sugg.personSpecificNote}
                      </span>
                    )}
                  </div>
                  <p className="text-12 text-content-secondary mt-0.5">{sugg.reason}</p>
                </div>
              </div>

              {/* Assign row (30px indent) */}
              <div className="flex flex-wrap gap-1.5 mt-2.5 ml-[30px]">
                {sugg.hasAllChip && (
                  <Chip
                    label="All"
                    selected={allSelected}
                    onClick={() => onToggleAll(sugg.id)}
                  />
                )}
                {sugg.memberIds.map(memberId => (
                  <Chip
                    key={memberId}
                    label={getMemberName(memberId)}
                    selected={sugg.assignedTo.includes(memberId)}
                    onClick={() => onToggleAssign(sugg.id, memberId)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-11 rounded-input px-2 py-1 transition-colors"
      style={
        selected
          ? { backgroundColor: '#3d6494', color: '#ffffff' }
          : { backgroundColor: '#f1efe8', color: '#1a1a1a', border: '0.5px solid rgba(0,0,0,0.08)' }
      }
    >
      {label}
    </button>
  )
}
