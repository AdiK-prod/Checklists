import { Check } from 'lucide-react'
import Avatar from '../ui/Avatar'

export default function Step2Travellers({ members, selected, onToggle, scratchMode }) {
  const selectedCount = selected.size

  return (
    <div className="pt-1">
      <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-3">
        Who's coming?
      </p>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {members.map(member => {
          const isSelected = selected.has(member.id)
          const roleLabel = member.role === 'parent'
            ? 'Parent'
            : member.age != null ? `Age ${member.age}` : 'Kid'

          return (
            <button
              key={member.id}
              onClick={() => onToggle(member.id)}
              className="flex items-center gap-2.5 bg-white rounded-card p-[14px] text-left transition-colors"
              style={{ border: `1.5px solid ${isSelected ? '#3d6494' : '#e0ddd8'}` }}
            >
              <Avatar member={member} size={34} />

              <div className="flex-1 min-w-0">
                <p className="text-13 font-medium text-content-primary truncate">{member.name}</p>
                <p className="text-11 text-content-secondary mt-0.5">{roleLabel}</p>
              </div>

              {/* Check circle */}
              <div
                className="w-[20px] h-[20px] rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isSelected ? '#3d6494' : 'transparent',
                  border: isSelected ? 'none' : '1.5px solid #e0ddd8',
                }}
              >
                {isSelected && <Check size={12} color="white" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-13 text-content-secondary mt-3 text-center">
        {selectedCount} traveller{selectedCount !== 1 ? 's' : ''} · each gets their own checklist
      </p>
      {scratchMode && selectedCount === 0 ? (
        <p className="text-12 mt-2 text-center leading-snug max-w-[320px] mx-auto" style={{ color: '#6b6b6b' }}>
          No travellers selected — you can add personal sections later.
        </p>
      ) : (
        <p className="text-12 text-content-secondary mt-2 text-center leading-snug max-w-[320px] mx-auto">
          Shared sections from this template are always included.
        </p>
      )}
    </div>
  )
}
